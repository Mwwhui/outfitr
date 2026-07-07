'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { compressImage } from '../wardrobe/upload/upload-utils';
import type { ClothingItem } from '@/lib/suggestOutfits';

const TRYON_RESULT_KEY = 'tryon-result-url';
const TRYON_HASH_KEY = 'tryon-last-hash';
const TRYON_HISTORY_KEY = 'tryon-history';
const MAX_HISTORY = 20;

interface HistoryEntry {
  url: string;
  hash: string;
  slots: { top: string | null; bottom: string | null; onepiece: string | null; outerwear: string | null };
  garmentCount: number;
  createdAt: number;
}

interface SlotsState {
  top: ClothingItem | null;
  bottom: ClothingItem | null;
  onepiece: ClothingItem | null;
  outerwear: ClothingItem | null;
}

interface TryOnPanelProps {
  slots: SlotsState;
  userPhotoUrl: string | null;
  onPhotoUploaded: (url: string) => void;
  onRestoreOutfit?: (slotIds: { top: string | null; bottom: string | null; onepiece: string | null; outerwear: string | null }) => void;
}

export default function TryOnPanel({
  slots,
  userPhotoUrl,
  onPhotoUploaded,
  onRestoreOutfit,
}: TryOnPanelProps) {
  const [resultUrl, setResultUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(TRYON_RESULT_KEY);
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedHash, setLastGeneratedHash] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(TRYON_HASH_KEY) || '';
    return '';
  });
  const [elapsed, setElapsed] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [resetsInDays, setResetsInDays] = useState<number | null>(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadingMessages = [
    'Analyzing your outfit...',
    'Applying garments onto your photo...',
    'Adjusting fit and details...',
    'Almost there...',
    'Final touch-ups...',
  ];

  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filledItems = Object.values(slots).filter(
    (v): v is ClothingItem => v !== null,
  );
  const itemsWithImages = filledItems.filter((i) => i.image_url);
  const currentHash = filledItems.map((i) => i.id).sort().join(',');

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRYON_HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  // Persist resultUrl + hash to localStorage whenever they change
  useEffect(() => {
    if (resultUrl && lastGeneratedHash) {
      localStorage.setItem(TRYON_RESULT_KEY, resultUrl);
      localStorage.setItem(TRYON_HASH_KEY, lastGeneratedHash);
    } else if (!resultUrl) {
      localStorage.removeItem(TRYON_RESULT_KEY);
      localStorage.removeItem(TRYON_HASH_KEY);
    }
  }, [resultUrl, lastGeneratedHash]);

  const saveToHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      const deduped = prev.filter((e) => e.hash !== entry.hash || e.url !== entry.url);
      const next = [entry, ...deduped].slice(0, MAX_HISTORY);
      localStorage.setItem(TRYON_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const startTimer = useCallback(() => {
    setElapsed(0);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  useEffect(() => {
    if (!userPhotoUrl || filledItems.length === 0) return;
    if (loading) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        `/api/tryon?garmentIds=${encodeURIComponent(currentHash)}`,
        { signal: controller.signal },
      )
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.cached && data?.url) {
            setResultUrl(data.url);
            setLastGeneratedHash(currentHash);
          }
          if (data?.remaining !== undefined) {
            setRemaining(data.remaining);
            setResetsInDays(data.resetsInDays ?? null);
          }
        })
        .catch(() => {});
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [userPhotoUrl, currentHash, filledItems.length, loading]);

  // Cycling loading messages
  useEffect(() => {
    if (!loading) {
      setLoadingMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % loadingMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [loading, loadingMessages.length]);

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressed);

      const res = await fetch('/api/user/photo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to upload photo');
        return;
      }

      const data = await res.json();
      onPhotoUploaded(data.url);
      setResultUrl(null);
      setLastGeneratedHash('');
      toast.success('Photo uploaded!');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (itemsWithImages.length === 0) {
      toast.error('Add items with photos to your outfit first');
      return;
    }

    setLoading(true);
    setError(null);
    startTimer();

    try {
      const res = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentIds: filledItems.map((i) => i.id),
          slots,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.rateLimited) {
          setError(
            `Monthly limit reached (12/12). Resets in ${data.resetsInDays} day${data.resetsInDays !== 1 ? 's' : ''}.`,
          );
        } else {
          setError(data.error || 'Try-on generation failed');
        }
        return;
      }

      setResultUrl(data.url);
      setLastGeneratedHash(currentHash);
      setRemaining(data.remaining);
      setResetsInDays(data.resetsInDays);

      saveToHistory({
        url: data.url,
        hash: currentHash,
        slots: {
          top: slots.top?.id ?? null,
          bottom: slots.bottom?.id ?? null,
          onepiece: slots.onepiece?.id ?? null,
          outerwear: slots.outerwear?.id ?? null,
        },
        garmentCount: filledItems.length,
        createdAt: Date.now(),
      });

      if (data.remaining !== undefined && data.remaining <= 3) {
        toast(
          `${data.remaining} try-on${data.remaining !== 1 ? 's' : ''} remaining this month`,
          { icon: '📊' },
        );
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      stopTimer();
    }
  };

  const renderHistory = () => {
    if (history.length === 0) return null;

    return (
      <div className="border-t border-slate-100">
        <button
          onClick={() => setHistoryOpen((o) => !o)}
          className="flex items-center gap-1.5 py-2 px-3 text-[11px] text-slate-400 hover:text-slate-600 transition w-full"
        >
          <svg
            className={`w-3 h-3 transition-transform ${historyOpen ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Past Previews
          <span className="text-slate-300">({history.length})</span>
        </button>
        {historyOpen && (
          <div
            ref={historyRef}
            className="flex gap-2 px-3 pb-2 overflow-x-auto"
          >
            {history.map((entry, i) => (
              <button
                key={`${entry.hash}-${i}`}
                onClick={() => {
                  if (onRestoreOutfit && entry.slots) {
                    onRestoreOutfit(entry.slots);
                  }
                  setResultUrl(entry.url);
                  setLastGeneratedHash(entry.hash);
                  setHistoryOpen(false);
                  toast.success('Preview loaded');
                }}
                className="shrink-0 relative group/thumb rounded-lg overflow-hidden border border-slate-200 hover:border-black transition"
                title={`Preview · ${new Date(entry.createdAt).toLocaleDateString()} · ${entry.garmentCount} items`}
              >
                <img
                  src={entry.url}
                  alt="Past preview"
                  className="w-14 h-18 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-500 font-headline flex items-center gap-1.5">
          Try-On Preview
          <div className="relative group">
            <span className="material-symbols-outlined text-xs text-slate-400 cursor-help">info</span>
            <div className="absolute left-0 top-6 z-10 w-56 p-3 bg-[#0f172a] text-white text-xs leading-relaxed rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal">
              Upload a photo, pick your outfit, and see how it looks on you. 12 uses per month.
              <span className="absolute top-full left-4 border-4 border-transparent border-t-[#0f172a]" />
            </div>
          </div>
        </h2>
        {remaining !== null && (
          <span className={`text-[11px] font-medium ${
            remaining <= 3 ? 'text-amber-500' : remaining === 0 ? 'text-red-500' : 'text-slate-400'
          }`}>
            {remaining}/{12}
            {resetsInDays !== null && remaining <= 3 ? ` · ${resetsInDays}d` : ''}
          </span>
        )}
      </div>

      {/* Hidden file input for photo upload — always mounted */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadPhoto}
      />

      {/* No photo state */}
      {!userPhotoUrl && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[360px] border-2 border-dashed border-slate-300 rounded-xl">
          <svg
            className="w-10 h-10 text-slate-300 mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="text-sm font-medium text-slate-600 mb-1">Upload your photo</p>
          <p className="text-xs text-slate-400 mb-4 text-center px-4">
            Full-body, front-facing photo for virtual try-on
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:scale-105 active:scale-95 transition disabled:opacity-50 disabled:hover:scale-100"
          >
            {uploadingPhoto ? 'Uploading...' : 'Choose Photo'}
          </button>
        </div>
      )}

      {/* Has photo but no items */}
      {userPhotoUrl && filledItems.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[360px] border-2 border-dashed border-slate-300 rounded-xl relative">
          <img
            src={userPhotoUrl}
            alt="Your photo"
            className="w-full h-56 object-contain rounded-lg mb-3 opacity-60"
          />
          <p className="text-sm text-slate-400">Add items to your outfit to see a preview</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition disabled:opacity-50"
            title="Change photo"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>
      )}

      {/* Main content area — generate prompt or result preview */}
      {userPhotoUrl && filledItems.length > 0 && !loading && (
        <div className="flex-1 flex flex-col min-h-[360px] border-2 border-dashed border-slate-300 rounded-xl relative overflow-hidden">
          {resultUrl ? (
            <>
              <img
                src={resultUrl}
                alt="Try-on result"
                className="w-full flex-1 object-contain"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition disabled:opacity-50 z-10"
                title="Change your photo"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              {lastGeneratedHash === currentHash && (
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-medium">
                  Cached
                </span>
              )}
              {renderHistory()}
              <div className="flex gap-2 p-3 bg-white border-t border-slate-100">
                <a
                  href={resultUrl}
                  download="outfitr-tryon.png"
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-black text-sm font-medium hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </a>
                <button
                  onClick={handleGenerate}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-black text-sm font-medium hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Regenerate
                </button>
              </div>
            </>
          ) : (
            <>
              <img
                src={userPhotoUrl}
                alt="Your photo"
                className="w-full h-48 object-contain rounded-lg mb-3 opacity-50 mt-4"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition disabled:opacity-50"
                title="Change photo"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              <div className="flex flex-col items-center justify-center flex-1 px-4">
                <p className="text-sm font-medium text-slate-600 mb-3">
                  {itemsWithImages.length} garment{itemsWithImages.length > 1 ? 's' : ''} ready
                </p>
                {itemsWithImages.length < filledItems.length && (
                  <p className="text-xs text-amber-500 mb-2">
                    {filledItems.length - itemsWithImages.length} item(s) without photo will be skipped
                  </p>
                )}
                <button
                  onClick={handleGenerate}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-zinc-800 via-zinc-900 to-black text-white text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Generate Preview
                </button>
                <p className="text-xs text-slate-400 mt-2">Free &middot; AI-powered</p>
              </div>
              {renderHistory()}
            </>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[360px] relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-white border border-slate-100">
          <img
            src={userPhotoUrl!}
            alt="Your photo"
            className="w-full h-52 object-contain rounded-lg mb-4 opacity-20 blur-sm scale-110"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition disabled:opacity-50 z-10"
            title="Change photo"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-black animate-spin mb-1" />
            <p className="text-sm font-semibold text-slate-700 min-h-[20px] transition-all duration-300">
              {loadingMessages[loadingMsgIndex]}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-xs text-slate-400 font-mono tabular-nums">{elapsed}s</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 text-center mb-4 max-w-xs">
            {error}
          </div>
          <button
            onClick={() => {
              setError(null);
              handleGenerate();
            }}
            className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-black text-sm font-medium hover:bg-slate-50 transition"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
