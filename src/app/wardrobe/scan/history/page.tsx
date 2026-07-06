'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import ScanScoreRing from '@/app/components/wardrobe/ScanScoreRing';
import ScanBreakdown from '@/app/components/wardrobe/ScanBreakdown';
import OutfitMultiplierCard from '@/app/components/wardrobe/OutfitMultiplierCard';
import CPWForecast from '@/app/components/wardrobe/CPWForecast';
import type { ScanResult, SimilarItem, SuggestedPairing } from '@/hooks/mutations/scanToBuy';

interface HistoryEntry {
  date: string;
  image_data_url: string | null;
  result: ScanResult;
}

export default function ScanHistoryPage() {
  const router = useRouter();
  const { status } = useSession();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('scan_wishlist');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized: HistoryEntry[] = parsed
            .filter((e): e is HistoryEntry => e && e.result && typeof e.result === 'object')
            .map((e) => ({
              ...e,
              result: {
                ...e.result,
                similar_items: Array.isArray(e.result.similar_items)
                  ? e.result.similar_items.map((s: unknown) =>
                      typeof s === 'string'
                        ? { name: s, image_url: null, id: '' }
                        : s,
                    ) as SimilarItem[]
                  : [],
                suggested_pairings: Array.isArray(e.result.suggested_pairings)
                  ? e.result.suggested_pairings.map((p: unknown) =>
                      typeof p === 'string'
                        ? { name: p, type: '', image_url: null, color: null }
                        : p,
                    ) as SuggestedPairing[]
                  : [],
              },
            }));
          setHistory(normalized);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const clearHistory = () => {
    localStorage.removeItem('scan_wishlist');
    setHistory([]);
    setExpandedIndex(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 max-w-lg mx-auto space-y-6">
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
            Scan History
          </h1>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs font-semibold text-red-500 hover:text-red-600 transition"
            >
              Clear All
            </button>
          )}
        </div>

        {history.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              history
            </span>
            <p className="text-sm text-on-surface-variant">
              No scans yet. Analyze a garment to get started.
            </p>
            <button
              onClick={() => router.push('/wardrobe/scan')}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-semibold hover:opacity-90 transition text-sm"
            >
              Scan a Garment
            </button>
          </div>
        )}

        <div className="space-y-3">
          {history.map((entry, i) => (
            <div
              key={i}
              className="bg-surface-bright border border-outline-variant rounded-xl overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedIndex(expandedIndex === i ? null : i)
                }
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-container-low transition"
              >
                <div className="w-12 h-12 rounded-lg bg-surface-variant overflow-hidden shrink-0">
                  {entry.image_data_url ? (
                    <Image
                      src={entry.image_data_url}
                      alt="Scanned item"
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant text-xl">
                        checkroom
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {entry.result.one_liner}
                  </p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {formatDate(entry.date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      entry.result.verdict === 'worth_it'
                        ? 'bg-green-100 text-green-700'
                        : entry.result.verdict === 'consider'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {entry.result.score}
                  </span>
                  <span className="material-symbols-outlined text-on-surface-variant text-lg">
                    {expandedIndex === i ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </button>

              {expandedIndex === i && (
                <div className="px-3 pb-4 space-y-4 border-t border-outline-variant pt-3">
                  <div className="flex justify-center">
                    <ScanScoreRing
                      score={entry.result.score}
                      verdict={entry.result.verdict}
                    />
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-semibold text-on-surface leading-relaxed">
                      {entry.result.one_liner}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      {entry.result.reasoning}
                    </p>
                  </div>

                  <ScanBreakdown breakdown={entry.result.breakdown} />

                  {entry.result.outfit_multiplier > 0 && (
                    <OutfitMultiplierCard
                      multiplier={entry.result.outfit_multiplier}
                      pairings={entry.result.suggested_pairings}
                    />
                  )}

                  {entry.result.cost_per_wear && (
                    <CPWForecast data={entry.result.cost_per_wear} />
                  )}

                  {entry.result.similar_items.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">
                          info
                        </span>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                          Similar Items in Your Closet
                        </p>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {entry.result.similar_items.map((item, j) => (
                          <button
                            key={j}
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

                  <p className="text-[10px] text-on-surface-variant text-center">
                    Scanned on {formatDate(entry.date)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {history.length > 0 && (
          <button
            onClick={() => router.push('/wardrobe/scan')}
            className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold hover:opacity-90 transition text-sm"
          >
            Scan Another Garment
          </button>
        )}
      </div>
    </div>
  );
}
