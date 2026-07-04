'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useUpdatePledgeStatus } from '@/hooks/mutations/pledges';
import type { IDetectedBarcode, IScannerError } from '@yudiel/react-qr-scanner';

const Scanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((m) => m.Scanner),
  { ssr: false },
);

const QR_PATTERN = /^outfitr:\/\/pledge\/([^?]+)\?token=(.+)$/;

interface PledgePreviewItem {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  status: string | null;
}

interface PledgePreviewUser {
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface PledgePreview {
  id: string;
  status: string;
  action_type: string;
  created_at: string;
  fulfilled_at: string | null;
  user: PledgePreviewUser;
  items: PledgePreviewItem[];
  partner_name: string;
}

type ScanPhase =
  | 'idle'
  | 'scanning'
  | 'confirming'
  | 'processing'
  | 'success'
  | 'error';

export default function PartnerScanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerKey, setScannerKey] = useState(0);
  const [pendingPledgeId, setPendingPledgeId] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<PledgePreview | null>(null);
  const [expandedImage, setExpandedImage] = useState<PledgePreviewItem | null>(null);

  const processingRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fulfillMutation = useUpdatePledgeStatus(session?.user?.id);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'partner') {
      router.push('/home');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'partner') {
      setPhase('scanning');
    }
  }, [status, session]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const resetScanner = useCallback(() => {
    setPhase('scanning');
    setErrorMessage('');
    setCameraError(null);
    setPendingPledgeId(null);
    setPendingToken(null);
    setPreview(null);
    setScannerKey((k) => k + 1);
    processingRef.current = false;
  }, []);

  const handleScan = useCallback(
    (detectedCodes: IDetectedBarcode[]) => {
      if (processingRef.current || !detectedCodes?.length) return;

      const rawValue = detectedCodes[0].rawValue;
      if (!rawValue) return;

      processingRef.current = true;

      const match = rawValue.match(QR_PATTERN);
      if (!match) {
        setErrorMessage(
          "Invalid QR code. Please scan the QR from the user's confirmation email.",
        );
        setPhase('error');
        resetTimerRef.current = setTimeout(resetScanner, 3000);
        return;
      }

      const [, pledgeId, token] = match;
      setPendingPledgeId(pledgeId);
      setPendingToken(token);

      fetch(
        `/api/partner/pledges/${pledgeId}?token=${encodeURIComponent(token)}`,
      )
        .then(async (res) => {
          if (!res.ok) {
            const err = await res
              .json()
              .catch(() => ({ error: 'Request failed' }));
            throw new Error(err.error || `Error ${res.status}`);
          }
          const data = await res.json();
          setPreview(data.pledge);
          setPhase('confirming');
        })
        .catch((err: Error) => {
          setErrorMessage(err.message);
          setPhase('error');
          resetTimerRef.current = setTimeout(resetScanner, 3000);
        });
    },
    [resetScanner],
  );

  const handleCancel = useCallback(() => {
    resetScanner();
  }, [resetScanner]);

  const handleConfirm = useCallback(async () => {
    if (!pendingPledgeId || !pendingToken) return;

    setPhase('processing');

    try {
      await fulfillMutation.mutateAsync({
        id: pendingPledgeId,
        action: 'fulfill',
        token: pendingToken,
      });

      setPhase('success');
      toast.success('Pledge fulfilled!');
      resetTimerRef.current = setTimeout(resetScanner, 2500);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong',
      );
      setPhase('error');
      resetTimerRef.current = setTimeout(resetScanner, 3000);
    }
  }, [pendingPledgeId, pendingToken, fulfillMutation, resetScanner]);

  const handleError = useCallback((error: IScannerError) => {
    console.error('Scanner error:', error);
    switch (error.kind) {
      case 'permission-denied':
        setCameraError(
          'Camera access denied. Please allow camera access in your browser settings and refresh the page.',
        );
        break;
      case 'no-camera':
        setCameraError(
          'No camera found on this device. Please use a device with a camera.',
        );
        break;
      case 'in-use':
        setCameraError(
          'Camera is being used by another application. Close it and try again.',
        );
        break;
      case 'overconstrained':
        setCameraError('Camera does not meet the required constraints.');
        break;
      case 'insecure-context':
        setCameraError(
          'Camera access requires a secure connection (HTTPS).',
        );
        break;
      case 'unsupported':
        setCameraError(
          'QR scanning is not supported on this browser. Try Chrome, Safari, or Firefox.',
        );
        break;
      default:
        setCameraError(
          `Camera error: ${error.message || 'Unknown error'}`,
        );
    }
    setPhase('error');
  }, []);

  const daysSince = (dateStr: string): number =>
    Math.floor(
      (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
    );

  const formatDate = (dateStr: string): string =>
    new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated' || session?.user?.role !== 'partner') {
    return null;
  }

  const scanOverlay =
    phase === 'confirming' || phase === 'processing' || phase === 'success';

  const userName = preview
    ? `${preview.user.first_name || ''} ${preview.user.last_name || ''}`.trim() ||
      preview.user.email
    : '';

  return (
    <div className="min-h-screen">
      <div className="px-6 pt-8 pb-4 max-w-4xl mx-auto">
        <Link
          href="/partner/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700 transition flex items-center gap-1"
        >
          ← Back to Dashboard
        </Link>
        <h2 className="text-3xl font-bold text-[#163422] mt-1 font-headline">
          Scan QR Code
        </h2>
      </div>

      <div className="px-6 pb-16 max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="relative aspect-[4/3] bg-black">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                <div className="text-5xl mb-4">📷</div>
                <p className="text-lg font-semibold mb-1">
                  Camera Unavailable
                </p>
                <p className="text-sm text-gray-300 mb-5 max-w-sm">
                  {cameraError}
                </p>
                <button
                  onClick={resetScanner}
                  className="bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <Scanner
                  key={scannerKey}
                  paused={scanOverlay}
                  onScan={handleScan}
                  onError={handleError}
                  constraints={{ facingMode: 'environment' }}
                  components={{ finder: !scanOverlay, torch: true }}
                  sound={true}
                  styles={{
                    container: { width: '100%', height: '100%' },
                    video: { objectFit: 'cover' },
                  }}
                />

                {phase === 'scanning' && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-sm">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Scanning for QR code...
                  </div>
                )}

                {/* Confirmation overlay */}
                {phase === 'confirming' && preview && (
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                    <div className="p-5 text-white animate-[fadeIn_0.3s_ease-out]">
                      {/* Already fulfilled */}
                      {preview.status === 'fulfilled' && (
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-blue-500/30 rounded-full flex items-center justify-center text-xl">
                              ✅
                            </div>
                            <div>
                              <p className="font-semibold text-base">
                                Already Fulfilled
                              </p>
                              {preview.fulfilled_at && (
                                <p className="text-sm text-white/70">
                                  {formatDate(preview.fulfilled_at)}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={resetScanner}
                            className="w-full mt-2 bg-white/20 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-white/30 transition"
                          >
                            Got it
                          </button>
                        </div>
                      )}

                      {/* Pending (not yet accepted) */}
                      {preview.status === 'pending' && (
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-amber-500/30 rounded-full flex items-center justify-center text-xl">
                              ⏳
                            </div>
                            <div>
                              <p className="font-semibold text-base">
                                Not Yet Accepted
                              </p>
                              <p className="text-sm text-white/70">
                                Accept this request from the dashboard first
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={resetScanner}
                            className="w-full mt-2 bg-white/20 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-white/30 transition"
                          >
                            Got it
                          </button>
                        </div>
                      )}

                      {/* Rejected */}
                      {preview.status === 'rejected' && (
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-red-500/30 rounded-full flex items-center justify-center text-xl">
                              ❌
                            </div>
                            <div>
                              <p className="font-semibold text-base">
                                Request Was Rejected
                              </p>
                              <p className="text-sm text-white/70">
                                This request was previously rejected
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={resetScanner}
                            className="w-full mt-2 bg-white/20 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-white/30 transition"
                          >
                            Got it
                          </button>
                        </div>
                      )}

                      {/* Ready to fulfill */}
                      {preview.status === 'accepted' && (
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">👤</span>
                              <div>
                                <p className="font-semibold text-base leading-tight">
                                  {userName}
                                </p>
                                <p className="text-xs text-white/60">
                                  {preview.user.email}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-white/80 mt-2">
                              <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs font-medium uppercase tracking-wide">
                                {preview.action_type}
                              </span>
                              <span className="text-white/40">·</span>
                              <span>{preview.partner_name}</span>
                            </div>
                          </div>

                          <div className="mb-3">
                            <p className="text-xs text-white/50 uppercase tracking-wide mb-1.5">
                              Items ({preview.items.length})
                            </p>
                            <ul className="space-y-1.5">
                              {preview.items.slice(0, 3).map((item) => (
                                <li
                                  key={item.id}
                                  className="text-sm text-white/90 flex items-center gap-2"
                                >
                                  {item.image_url ? (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedImage(item)}
                                      className="shrink-0"
                                    >
                                      <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="w-8 h-8 rounded-lg object-cover cursor-pointer hover:ring-2 hover:ring-white/50 transition"
                                      />
                                    </button>
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                      <span className="text-xs text-white/40">
                                        N/A
                                      </span>
                                    </div>
                                  )}
                                  <span className="truncate">
                                    {item.name}
                                  </span>
                                  {item.brand && (
                                    <span className="text-white/40 text-xs truncate">
                                      · {item.brand}
                                    </span>
                                  )}
                                </li>
                              ))}
                              {preview.items.length > 3 && (
                                <li className="text-xs text-white/50">
                                  +{preview.items.length - 3} more
                                </li>
                              )}
                            </ul>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-white/50 mb-4">
                            <span>⏱️</span>
                            <span>
                              Pledged {daysSince(preview.created_at)} day
                              {daysSince(preview.created_at) !== 1 ? 's' : ''}{' '}
                              ago
                            </span>
                            {daysSince(preview.created_at) > 30 && (
                              <span className="text-amber-300 font-medium ml-1">
                                · Verify with user
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={handleCancel}
                              className="flex-1 bg-white/20 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-white/30 transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleConfirm}
                              className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600 transition"
                            >
                              Confirm Fulfillment
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Processing / Success overlay */}
                {(phase === 'processing' || phase === 'success') && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                    {phase === 'processing' && (
                      <>
                        <div className="w-14 h-14 border-3 border-white border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-lg font-semibold">
                          Verifying pledge...
                        </p>
                      </>
                    )}
                    {phase === 'success' && (
                      <>
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                          <svg
                            className="w-8 h-8 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <p className="text-xl font-bold">
                          Pledge Fulfilled!
                        </p>
                        <p className="text-sm text-gray-300 mt-1">
                          {userName}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Ready for next scan...
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-red-800">
                Scan Failed
              </p>
              <p className="text-sm text-red-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h3 className="font-semibold text-[#163422] text-sm mb-3 font-headline">
            Tips for scanning
          </h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">1.</span>
              Hold the QR code flat and steady, avoiding wrinkles
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">2.</span>
              Ensure good lighting — avoid glare or shadows on the QR
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">3.</span>
              Position the QR code within the viewfinder frame
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">4.</span>
              Confirm the user&apos;s identity and items before fulfilling
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">5.</span>
              Each QR code works only once and is tied to your account
            </li>
          </ul>
        </div>
      </div>

      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
          onClick={() => setExpandedImage(null)}
        >
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none"
          >
            ✕
          </button>
          <div className="max-w-full max-h-full flex flex-col items-center">
            <img
              src={expandedImage.image_url!}
              alt={expandedImage.name}
              className="max-w-full max-h-[75vh] rounded-xl object-contain"
            />
            <p className="text-white text-sm mt-3 font-medium">
              {expandedImage.name}
              {expandedImage.brand && (
                <span className="text-white/50"> · {expandedImage.brand}</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
