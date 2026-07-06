'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useScanToBuy, type ScanResult } from '@/hooks/mutations/scanToBuy';
import { compressImage } from '../upload/upload-utils';
import ScanScoreRing from '@/app/components/wardrobe/ScanScoreRing';
import ScanBreakdown from '@/app/components/wardrobe/ScanBreakdown';
import OutfitMultiplierCard from '@/app/components/wardrobe/OutfitMultiplierCard';
import CPWForecast from '@/app/components/wardrobe/CPWForecast';
import Loader from '@/app/components/Loader';
import Image from 'next/image';

type PageStep = 'input' | 'analyzing' | 'result';

const ANALYZE_STEPS = [
  'Detecting garment type...',
  'Checking your wardrobe...',
  'Calculating outfit combos...',
  'Generating verdict...',
];

export default function ScanToBuyPage() {
  const router = useRouter();
  const { status } = useSession();
  const scanMutation = useScanToBuy();

  const [step, setStep] = useState<PageStep>('input');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState<string | null>(null);
  const [analyzingIndex, setAnalyzingIndex] = useState(0);
  const [isStuck, setIsStuck] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [wishlistMessage, setWishlistMessage] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  // Attach camera stream to video element after it renders
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Auto-save scan result to history
  useEffect(() => {
    if (!scanMutation.isSuccess || !scanMutation.data) return;
    try {
      const stored = localStorage.getItem('scan_wishlist');
      const wishlist = stored ? JSON.parse(stored) : [];
      wishlist.unshift({
        date: new Date().toISOString(),
        image_data_url: capturedImageDataUrl,
        result: scanMutation.data,
      });
      if (wishlist.length > 50) wishlist.length = 50;
      localStorage.setItem('scan_wishlist', JSON.stringify(wishlist));
      setWishlistMessage('Saved!');
    } catch {
      if (typeof localStorage !== 'undefined') {
        try {
          const estimated = new Blob([JSON.stringify(scanMutation.data)]).size;
          if (estimated > 4_000_000) {
            setWishlistMessage('Image too large');
          }
        } catch {
          setWishlistMessage('Save failed');
        }
      }
    }
  }, [scanMutation.isSuccess, scanMutation.data, capturedImageDataUrl]);

  // Advance analyzing steps + stuck detection
  useEffect(() => {
    if (step !== 'analyzing') {
      setIsStuck(false);
      return;
    }
    if (scanMutation.isSuccess || scanMutation.isError) {
      setStep('result');
      return;
    }
    const interval = setInterval(() => {
      setAnalyzingIndex((i) => Math.min(i + 1, ANALYZE_STEPS.length - 1));
    }, 2500);
    const stuckTimer = setTimeout(() => setIsStuck(true), 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(stuckTimer);
    };
  }, [step, scanMutation.isSuccess, scanMutation.isError]);

  const handleImageSelect = async (file: File) => {
    const compressed = await compressImage(file);
    setImageFile(compressed);
    setImagePreview(URL.createObjectURL(compressed));

    const reader = new FileReader();
    reader.onload = async () => {
      const fullDataUrl = reader.result as string;
      setCapturedImageDataUrl(fullDataUrl);
      const base64 = fullDataUrl.split(',')[1];
      setStep('analyzing');
      setAnalyzingIndex(0);
      const price = parseFloat(priceInput) || undefined;
      scanMutation.mutate({
        imageBase64: base64,
        mimeType: compressed.type || 'image/jpeg',
        price,
      });
    };
    reader.readAsDataURL(compressed);
  };

  const handleGalleryPick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleImageSelect(file);
    };
    input.click();
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setCameraStream(stream);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : 'Camera unavailable';
      setCameraError(msg);
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        handleImageSelect(file);
      }
    }, 'image/jpeg');
    // Stop camera
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
  };

  const resetScan = () => {
    setStep('input');
    setImageFile(null);
    setImagePreview(null);
    setCapturedImageDataUrl(null);
    setAnalyzingIndex(0);
    setIsStuck(false);
    setCameraError('');
    setPriceInput('');
    setWishlistMessage('');
    scanMutation.reset();
  };

  const result: ScanResult | undefined = scanMutation.data;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-xl hover:bg-surface-container transition"
          >
            <span className="material-symbols-outlined text-xl">
              arrow_back
            </span>
          </button>
          <h1 className="text-xl font-bold font-headline text-on-surface flex-1">
            Scan to Buy
          </h1>
          <button
            onClick={() => router.push('/wardrobe/scan/history')}
            className="p-2 rounded-xl hover:bg-surface-container transition"
            title="Scan history"
          >
            <span className="material-symbols-outlined text-xl">
              history
            </span>
          </button>
        </div>

        {/* Step: Input */}
        {step === 'input' && (
          <div className="space-y-6">
            <p className="text-sm text-on-surface-variant">
              Photograph a garment you&apos;re considering buying. We&apos;ll
              analyze whether it fits your wardrobe.
            </p>

            {/* Preview area */}
            {imagePreview && (
              <div className="relative w-full aspect-[4/3] bg-surface-variant rounded-xl overflow-hidden">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-contain"
                />
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setImageFile(null);
                  }}
                  className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center shadow"
                >
                  <span className="material-symbols-outlined text-sm">
                    close
                  </span>
                </button>
              </div>
            )}

            {/* Camera viewfinder */}
            {!imagePreview && cameraStream && (
              <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={captureFromCamera}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-black rounded-full w-14 h-14 shadow-lg flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-2xl">
                    camera
                  </span>
                </button>
                <button
                  onClick={() => {
                    cameraStream.getTracks().forEach((t) => t.stop());
                    setCameraStream(null);
                  }}
                  className="absolute top-2 right-2 bg-white/80 rounded-full w-8 h-8 flex items-center justify-center shadow"
                >
                  <span className="material-symbols-outlined text-sm">
                    close
                  </span>
                </button>
              </div>
            )}

            {/* Action buttons */}
            {!imagePreview && !cameraStream && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center gap-2 bg-surface-bright border border-outline-variant rounded-xl p-6 hover:bg-surface-container-low transition"
                >
                  <span className="material-symbols-outlined text-3xl text-primary">
                    camera_alt
                  </span>
                  <span className="text-sm font-semibold text-on-surface">
                    Camera
                  </span>
                </button>
                <button
                  onClick={handleGalleryPick}
                  className="flex flex-col items-center gap-2 bg-surface-bright border border-outline-variant rounded-xl p-6 hover:bg-surface-container-low transition"
                >
                  <span className="material-symbols-outlined text-3xl text-primary">
                    photo_library
                  </span>
                  <span className="text-sm font-semibold text-on-surface">
                    Gallery
                  </span>
                </button>
              </div>
            )}

            {cameraError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">
                  warning
                </span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-700">{cameraError}</p>
                  <p className="text-[10px] text-red-600 mt-0.5">
                    Try using the gallery button instead.
                  </p>
                </div>
                <button
                  onClick={() => handleGalleryPick()}
                  className="text-xs font-semibold text-red-600 underline shrink-0"
                >
                  Use Gallery
                </button>
              </div>
            )}

            {/* Price input (optional) */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                Price (optional — for cost-per-wear analysis)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">
                  $
                </span>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-outline-variant text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                />
              </div>
            </div>

            {imagePreview && (
              <button
                onClick={() => {
                  const file = imageFile;
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const fullDataUrl = reader.result as string;
                    setCapturedImageDataUrl(fullDataUrl);
                    const base64 = fullDataUrl.split(',')[1];
                    setStep('analyzing');
                    setAnalyzingIndex(0);
                    const price = parseFloat(priceInput) || undefined;
                    scanMutation.mutate({
                      imageBase64: base64,
                      mimeType: file.type || 'image/jpeg',
                      price,
                    });
                  };
                  reader.readAsDataURL(file);
                }}
                className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold hover:opacity-90 transition"
              >
                Analyze This Garment
              </button>
            )}
          </div>
        )}

        {/* Step: Analyzing */}
        {step === 'analyzing' && (
          <div className="space-y-8 py-8">
            <div className="relative w-full aspect-[4/3] bg-surface-variant rounded-xl overflow-hidden">
              {imagePreview && (
                <Image
                  src={imagePreview}
                  alt="Scanning"
                  fill
                  className="object-contain"
                />
              )}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <Loader message="" />
              </div>
            </div>

            <div className="space-y-4 max-w-xs mx-auto">
              {ANALYZE_STEPS.map((label, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      i < analyzingIndex
                        ? 'bg-primary text-on-primary'
                        : i === analyzingIndex
                          ? 'bg-primary text-on-primary animate-pulse'
                          : 'bg-surface-variant text-on-surface-variant'
                    }`}
                  >
                    {i < analyzingIndex ? (
                      <span className="material-symbols-outlined text-xs">
                        check
                      </span>
                    ) : (
                      <span className="text-xs font-bold">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-sm transition-colors ${
                      i <= analyzingIndex
                        ? 'text-on-surface font-semibold'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {isStuck && (
              <div className="text-center">
                <p className="text-sm text-amber-600 mb-1">
                  Still analyzing... This can take up to a minute.
                </p>
              </div>
            )}

            {scanMutation.isError && (
              <div className="text-center">
                <p className="text-sm text-red-500 mb-2">
                  {scanMutation.error?.message || 'Analysis failed'}
                </p>
                <button
                  onClick={resetScan}
                  className="text-sm font-semibold text-primary underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div className="space-y-6">
            {imagePreview && (
              <div className="relative w-full aspect-[4/3] bg-surface-variant rounded-xl overflow-hidden">
                <Image
                  src={imagePreview}
                  alt="Scanned item"
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div className="flex justify-center">
              <ScanScoreRing score={result.score} verdict={result.verdict} />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-on-surface leading-relaxed">
                {result.one_liner}
              </p>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                {result.reasoning}
              </p>
            </div>

            <ScanBreakdown breakdown={result.breakdown} />

            {result.outfit_multiplier > 0 && (
              <OutfitMultiplierCard
                multiplier={result.outfit_multiplier}
                pairings={result.suggested_pairings}
              />
            )}

            {result.cost_per_wear && (
              <CPWForecast data={result.cost_per_wear} />
            )}

            {result.similar_items.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-start gap-2 mb-2">
                  <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">
                    info
                  </span>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Similar Items in Your Closet
                  </p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {result.similar_items.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => router.push(`/wardrobe/${item.id}`)}
                      className="shrink-0 flex flex-col items-center gap-1.5 w-20"
                    >
                      <div className="w-16 h-16 rounded-lg bg-amber-100 overflow-hidden border border-amber-200">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-amber-400 text-xl">
                              checkroom
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-amber-700 text-center leading-tight line-clamp-2">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={resetScan}
                className="flex-1 border border-primary text-primary py-2.5 rounded-xl font-semibold hover:bg-primary hover:text-on-primary transition text-sm"
              >
                Scan Another
              </button>
              <div className="flex-1 flex items-center justify-center gap-1.5 bg-surface-container-low border border-outline-variant rounded-xl py-2.5 text-sm font-semibold text-on-surface-variant">
                <span className="material-symbols-outlined text-base">
                  {wishlistMessage === 'Saved!' ? 'check_circle' : 'history'}
                </span>
                <span>Saved to History</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
