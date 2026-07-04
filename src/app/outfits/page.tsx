'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useWeather } from '@/hooks/queries/weather';
import { useClothes, type ClothingItem } from '@/hooks/queries/wardrobe';
import { useOutfitPlans } from '@/hooks/queries/calendar';
import {
  useFrequentCombos,
  useOutfitDNA,
  useOutfitSuggestions,
  type FrequentCombo,
  type OutfitDNA,
} from '@/hooks/queries/outfits';
import StyleLabImpactMeter from '../components/outfits/StyleLabImpactMeter';
import PlannedOutfitsSidebar from '../components/outfits/PlannedOutfitsSidebar';
import ConfirmModal from '../components/ConfirmModal';

interface ComboItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
}

interface AISuggestion {
  items: ComboItem[];
  score: number;
  ai_reasoning: string;
  style: string;
  color_harmony: number;
}

function findClothByName(
  clothes: ClothingItem[],
  name: string,
): ClothingItem | undefined {
  const exact = clothes.find((c) => c.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return clothes.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      lower.includes(c.name.toLowerCase()),
  );
}

function ComboImageGrid({ items }: { items: ComboItem[] }) {
  const grid = items.slice(0, 4);
  while (grid.length < 4)
    grid.push({
      id: `empty-${grid.length}`,
      name: '',
      type: '',
      color: null,
      image_url: null,
    });

  return (
    <div className="grid grid-cols-2 gap-2 aspect-[4/3]">
      {grid.map((item, i) => (
        <div
          key={item.id + i}
          className="bg-surface-container rounded-lg overflow-hidden"
        >
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : item.type ? (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: item.color || '#e3e2e2' }}
            >
              <span className="text-[10px] font-medium text-on-surface-variant">
                {item.type}
              </span>
            </div>
          ) : (
            <div className="w-full h-full bg-surface-container" />
          )}
        </div>
      ))}
    </div>
  );
}

function getNextWeekday(dayIndex: number): string {
  const now = new Date();
  const currentDay = now.getDay();
  let daysAhead = dayIndex - currentDay;
  if (daysAhead <= 0) daysAhead += 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysAhead);
  return target.toISOString().slice(0, 10);
}

function itemsToPlannerParams(
  items: Array<{ id: string; type: string }>,
): string {
  const params = new URLSearchParams();
  for (const item of items) {
    const key =
      item.type === 'Tops'
        ? 'top'
        : item.type === 'Bottoms'
          ? 'bottom'
          : item.type === 'Outerwear'
            ? 'outerwear'
            : item.type === 'One-Piece'
              ? 'onepiece'
              : null;
    if (key) params.set(key, item.id);
  }
  return params.toString();
}

function MiniCalendarPicker({
  items,
  onScheduled,
}: {
  items: ComboItem[];
  onScheduled: () => void;
}) {
  const [scheduling, setScheduling] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayIndices = [1, 2, 3, 4, 5, 6, 0];
  const dayLabels: Record<number, string> = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    0: 'Sun',
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex],
    );
  };

  const handleConfirm = async () => {
    if (selectedDays.length === 0) return;
    setScheduling(true);
    try {
      const slots: Record<
        string,
        {
          id: string;
          name: string;
          image_url: string | null;
          color: string | null;
          type: string;
        }
      > = {};
      for (const item of items) {
        const key =
          item.type === 'Tops'
            ? 'top'
            : item.type === 'Bottoms'
              ? 'bottom'
              : item.type === 'Outerwear'
                ? 'outerwear'
                : item.type === 'One-Piece'
                  ? 'onepiece'
                  : item.type === 'Shoes'
                    ? 'shoes'
                    : item.type === 'Accessories'
                      ? 'accessories'
                      : null;
        if (key)
          slots[key] = {
            id: item.id,
            name: item.name,
            image_url: item.image_url,
            color: item.color,
            type: item.type,
          };
      }
      const name = items.map((i) => i.name).join(' + ');
      await Promise.all(
        selectedDays.map((dayIndex) =>
          fetch('/api/outfit_plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: getNextWeekday(dayIndex),
              timeSlot: 'day',
              slots,
              name,
            }),
          }).then((res) => {
            if (!res.ok) throw new Error('Failed to schedule');
          }),
        ),
      );
      onScheduled();
    } catch {
      /* silently fail */
    } finally {
      setScheduling(false);
      setShowModal(false);
      setSelectedDays([]);
    }
  };

  return (
    <>
      <div className="mt-3 p-3 bg-surface-container-lowest border border-outline-variant rounded-lg">
        <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-2">
          Schedule Weekly
        </p>
        <div className="flex justify-between gap-1">
          {days.map((day, i) => (
            <button
              key={i}
              onClick={() => toggleDay(dayIndices[i])}
              disabled={scheduling}
              className={`flex-1 py-1 rounded border text-sm transition-colors disabled:opacity-50 ${
                selectedDays.includes(dayIndices[i])
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant hover:bg-primary hover:text-on-primary'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
        {selectedDays.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            disabled={scheduling}
            className="mt-2 w-full bg-primary text-on-primary text-sm py-1.5 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            Schedule Weekly
          </button>
        )}
      </div>
      <ConfirmModal
        open={showModal}
        title="Schedule Outfit"
        message={`Schedule "${items.map((i) => i.name).join(' + ')}" to ${selectedDays.map((d) => dayLabels[d]).join(', ')}?`}
        confirmLabel={
          selectedDays.length > 1
            ? `Schedule ${selectedDays.length} days`
            : 'Schedule'
        }
        cancelLabel="Cancel"
        confirmVariant="primary"
        onConfirm={handleConfirm}
        onCancel={() => {
          setShowModal(false);
          setSelectedDays([]);
        }}
        loading={scheduling}
      />
    </>
  );
}

export default function OutfitsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [schedulingCombo, setSchedulingCombo] = useState<string | null>(null);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [archivedKeys, setArchivedKeys] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<
    'all' | 'favorites' | 'archived'
  >('favorites');
  const [dnaLoaded, setDnaLoaded] = useState(false);

  const { data: freqData, isLoading: combosLoading } = useFrequentCombos(session?.user?.id, 10);
  const {
    data: dna,
    refetch: refetchDna,
    isLoading: dnaLoading,
    fetchStatus: dnaFetchStatus,
  } = useOutfitDNA(session?.user?.id);
  const { data: weatherResult } = useWeather(status === 'authenticated');
  const { data: plans = [], refetch: refetchPlans } = useOutfitPlans(
    session?.user?.id,
    new Date().toISOString().slice(0, 10),
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const { data: clothesData } = useClothes(session?.user?.id);

  const frequentCombos: FrequentCombo[] = freqData?.combos || [];
  const totalOutfits = freqData?.total_outfits || 0;
  const uniqueCombos = freqData?.unique_combos || 0;
  const clothes: ClothingItem[] = clothesData || [];

  const weather = useMemo<{
    temp: number;
    description: string;
    icon: string;
    weathercode: number;
  } | null>(() => {
    if (!weatherResult?.current) return null;
    const code = weatherResult.current.weathercode;
    let icon = 'cloud';
    let description = 'Cloudy';
    if (code <= 3) {
      icon = 'weather_sunny';
      description = 'Clear';
    } else if (code <= 49) {
      icon = 'cloud';
      description = 'Cloudy';
    } else if (code <= 67) {
      icon = 'rainy';
      description = 'Rainy';
    } else if (code <= 77) {
      icon = 'weather_snowy';
      description = 'Snowy';
    } else if (code <= 86) {
      icon = 'weather_snowy';
      description = 'Snowy';
    } else {
      icon = 'thunderstorm';
      description = 'Stormy';
    }
    return {
      temp: weatherResult.current.temperature,
      description,
      icon,
      weathercode: code,
    };
  }, [weatherResult]);

  const { data: suggestionsData } = useOutfitSuggestions(
    session?.user?.id,
    weather
      ? {
          temperature: weather.temp,
          weathercode: weather.weathercode,
          description: weather.description,
          icon: weather.icon,
        }
      : null,
  );
  const suggestions: AISuggestion[] = (suggestionsData?.suggestions || []).map(
    (s) => ({
      items: s.items,
      score: s.score,
      ai_reasoning: s.ai_reasoning,
      style: s.style,
      color_harmony: s.color_harmony,
    }),
  );

  const totalItems = useMemo(() => {
    const ids = new Set<string>();
    for (const combo of frequentCombos) {
      for (const item of combo.items) ids.add(item.id);
    }
    return ids.size;
  }, [frequentCombos]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
  }, [status, router]);

  // Auto-load DNA once on mount
  useEffect(() => {
    if (!dnaLoaded && dnaFetchStatus === 'idle' && !dnaLoading) {
      refetchDna();
      setDnaLoaded(true);
    }
  }, [dnaLoaded, dnaFetchStatus, dnaLoading, refetchDna]);

  // Load favorite combos from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('outfit_favorites');
      if (stored) setFavoriteKeys(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  // Persist favorite combos
  useEffect(() => {
    localStorage.setItem('outfit_favorites', JSON.stringify([...favoriteKeys]));
  }, [favoriteKeys]);

  // Load archived combos from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('outfit_archived');
      if (stored) setArchivedKeys(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  // Persist archived combos
  useEffect(() => {
    localStorage.setItem('outfit_archived', JSON.stringify([...archivedKeys]));
  }, [archivedKeys]);

  const usageRate =
    totalItems > 0 ? Math.round((uniqueCombos / totalItems) * 100) : 0;

  const bentoItem = useMemo(() => {
    const adv = suggestions.find((s) => s.style === 'adventurous');
    if (adv) {
      const enrichedItems = adv.items.map((item) => {
        const cloth = clothes.find((c) => c.id === item.id);
        return {
          ...item,
          image_url: cloth?.image_url || item.image_url,
          color: cloth?.color || item.color,
          use_case: cloth?.use_case || [],
        };
      });
      return {
        items: enrichedItems,
        reason: adv.ai_reasoning,
        score: adv.score,
        style: adv.style,
        source: 'suggestion' as const,
        title: adv.items.map((i) => i.name).join(' + '),
      };
    }
    if (dna?.pattern_breakers.length) {
      const pb = dna.pattern_breakers[0];
      const enrichedItems = pb.combo_items.map((item) => {
        const cloth = clothes.find((c) => c.id === item.id);
        return {
          ...item,
          image_url: cloth?.image_url || item.image_url,
          color: cloth?.color || item.color,
          use_case: cloth?.use_case || [],
        };
      });
      return {
        items: enrichedItems,
        reason: pb.reason,
        score: pb.combo.length * 15,
        source: 'pattern_breaker' as const,
        title: pb.combo.join(' + '),
      };
    }
    return null;
  }, [suggestions, dna, clothes]);

  const secondaryItems = useMemo(() => {
    if (!dna?.never_tried.length) return [];
    const bentoIds = new Set(bentoItem?.items.map((i) => i.id) || []);
    return dna.never_tried
      .filter((nt) => {
        if (nt.item_a_id && bentoIds.has(nt.item_a_id)) return false;
        if (nt.item_b_id && bentoIds.has(nt.item_b_id)) return false;
        return true;
      })
      .slice(0, 4)
      .map((nt) => {
        const itemA =
          clothes.find((c) => c.id === nt.item_a_id) ||
          findClothByName(clothes, nt.item_a);
        const itemB =
          clothes.find((c) => c.id === nt.item_b_id) ||
          findClothByName(clothes, nt.item_b);
        const items = [itemA, itemB].filter(Boolean) as ClothingItem[];
        return {
          title: `${nt.item_a} × ${nt.item_b}`,
          reason: nt.reason,
          items,
        };
      });
  }, [dna, clothes, bentoItem]);

  // Impact Meter computations
  const suggestionItems = suggestions.flatMap((s) => s.items);
  const uniqueSuggestionIds = [...new Set(suggestionItems.map((i) => i.id))];
  const uniqueReactivated = new Set(
    suggestionItems
      .filter((i) => {
        const cloth = clothes.find((c) => c.id === i.id);
        return cloth && (cloth.wear_count ?? 0) <= 2;
      })
      .map((i) => i.id),
  ).size;
  const totalSuggestedItems = uniqueSuggestionIds.length;

  // Weekly change: compare plans from last 7 days vs previous 7 days
  const weeklyChange = useMemo(() => {
    if (plans.length === 0) return 0;
    const today = new Date();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - 6);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const thisWeekItems = new Set<string>();
    const lastWeekItems = new Set<string>();

    plans.forEach((plan) => {
      const planDate = new Date(plan.date);
      Object.values(plan.slots).forEach((slot) => {
        if (slot && typeof slot === 'object' && 'id' in slot) {
          if (planDate >= thisWeekStart) {
            thisWeekItems.add((slot as { id: string }).id);
          } else if (planDate >= lastWeekStart && planDate < thisWeekStart) {
            lastWeekItems.add((slot as { id: string }).id);
          }
        }
      });
    });

    if (lastWeekItems.size === 0) return thisWeekItems.size > 0 ? 100 : 0;
    return Math.round(
      ((thisWeekItems.size - lastWeekItems.size) / lastWeekItems.size) * 100,
    );
  }, [plans]);

  // Handlers for PlannedOutfitsSidebar
  const refreshPlans = () => {
    refetchPlans();
  };

  const toggleFavorite = (key: string) => {
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleArchive = (key: string) => {
    setArchivedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleCombos =
    filterMode === 'favorites'
      ? frequentCombos.filter((c) => favoriteKeys.has(c.key))
      : filterMode === 'archived'
        ? frequentCombos.filter((c) => archivedKeys.has(c.key))
        : frequentCombos.filter((c) => !archivedKeys.has(c.key));

  const handleQuickSwap = async (planId: string, date: string) => {
    await fetch(`/api/outfit_plans/${planId}`, { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: ['outfit-plans'] });
    router.push(`/planner?date=${date}&timeSlot=day`);
  };

  const handlePlanDay = (date: string) => {
    router.push(`/planner?date=${date}&timeSlot=day`);
  };

  if (status === 'loading' || combosLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-6 md:px-8 lg:px-12 py-8 max-w-[1280px] mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-48 bg-surface-variant rounded" />
            <div className="h-64 bg-surface-variant rounded-xl" />
            <div className="grid grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-72 bg-surface-variant rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 md:px-8 lg:px-12 py-8 max-w-[1280px] mx-auto space-y-8">
        {/* Navigation header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-on-surface font-headline tracking-tight">
            Style Lab
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            <span className="font-semibold">{totalOutfits} outfits worn</span>{' '}
            &middot;{' '}
            <span className="font-semibold">
              {uniqueCombos} unique combinations
            </span>
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left column — main content */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* Outfit DNA */}
            {dna && (
              <section
                className={`transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >
                <div className="bg-gradient-to-br from-primary to-[#1a1a1a] text-on-primary p-6 rounded-xl flex flex-col md:flex-row gap-6 items-center relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle, white 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                  />
                  <div className="flex-1 z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="material-symbols-outlined text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        psychiatry
                      </span>
                      <span className="text-sm uppercase tracking-wider font-semibold">
                        Your Outfit DNA
                      </span>
                    </div>
                    <p className="text-base leading-relaxed max-w-2xl text-on-primary/80">
                      {dna.style_summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-4 items-center">
                      {frequentCombos.length > 0 && (
                        <>
                          <div className="flex gap-1">
                            {(() => {
                              const colors = [
                                ...new Set(
                                  frequentCombos
                                    .flatMap((c) => c.items)
                                    .filter((i) => i.color)
                                    .map((i) => i.color!),
                                ),
                              ].slice(0, 3);
                              return colors.map((color, i) => (
                                <div
                                  key={i}
                                  className="w-6 h-6 rounded-full border border-outline"
                                  style={{ backgroundColor: color }}
                                />
                              ));
                            })()}
                          </div>
                          <div className="h-4 w-px bg-on-primary/30" />
                        </>
                      )}
                      {dna.color_habits.length > 0 && (
                        <div className="flex gap-2">
                          {dna.color_habits.slice(0, 3).map((habit, i) => (
                            <span
                              key={i}
                              className="bg-on-primary/10 px-3 py-1 rounded-full text-xs border border-on-primary/20"
                            >
                              {habit}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {dna.formula && (
                    <div className="z-10 bg-on-primary/5 p-4 rounded-lg border border-on-primary/10 backdrop-blur-sm min-w-[240px]">
                      <h4 className="text-xs mb-2 font-bold opacity-80 uppercase">
                        Formula
                      </h4>
                      <p className="text-sm italic mb-3">
                        &ldquo;{dna.formula}&rdquo;
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Usage Rate</span>
                          <span>{usageRate}%</span>
                        </div>
                        <div className="w-full bg-white/20 h-1 rounded-full">
                          <div
                            className="bg-white h-1 rounded-full transition-all"
                            style={{ width: `${usageRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {!dna && !dnaLoading && (
              <button
                onClick={() => refetchDna()}
                className={`w-full text-left transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >
                <div className="bg-gradient-to-br from-primary to-[#1a1a1a] text-on-primary p-6 rounded-xl hover:opacity-90 transition-opacity relative overflow-hidden group">
                  <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle, white 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                  />
                  <div className="relative z-10 flex items-center gap-3">
                    <span
                      className="material-symbols-outlined text-xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      psychiatry
                    </span>
                    <div>
                      <span className="text-sm uppercase tracking-wider font-semibold block">
                        Unlock Your Outfit DNA
                      </span>
                      <span className="text-xs text-on-primary/60">
                        Analyze your style patterns with AI
                      </span>
                    </div>
                    <span className="material-symbols-outlined ml-auto group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </button>
            )}

            {dnaLoading && (
              <section
                className={`transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}
              >
                <div className="bg-gradient-to-br from-primary to-[#1a1a1a] text-on-primary p-6 rounded-xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                  <div className="relative z-10 animate-pulse">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded-full bg-on-primary/20" />
                      <div className="h-4 w-32 bg-on-primary/20 rounded" />
                    </div>
                    <div className="space-y-2 mb-4 max-w-2xl">
                      <div className="h-4 w-full bg-on-primary/10 rounded" />
                      <div className="h-4 w-3/4 bg-on-primary/10 rounded" />
                      <div className="h-4 w-1/2 bg-on-primary/10 rounded" />
                    </div>
                    <div className="flex gap-2 mb-4">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full bg-on-primary/10"
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 w-24 bg-on-primary/10 rounded-full" />
                      <div className="h-6 w-24 bg-on-primary/10 rounded-full" />
                    </div>
                  </div>
                  <div className="hidden md:block absolute right-6 top-1/2 -translate-y-1/2 w-[240px]">
                    <div className="bg-on-primary/5 p-4 rounded-lg border border-on-primary/10 animate-pulse">
                      <div className="h-3 w-16 bg-on-primary/20 rounded mb-3" />
                      <div className="h-4 w-full bg-on-primary/10 rounded mb-2" />
                      <div className="h-2 w-full bg-on-primary/10 rounded" />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Common Combinations */}
            {frequentCombos.length > 0 && (
              <section
                className={`transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="text-xl font-bold text-on-surface font-headline">
                    Common Combinations
                  </h2>
                  <div className="flex ml-auto gap-1 bg-surface-container-high rounded-lg p-0.5">
                    <button
                      onClick={() => setFilterMode('favorites')}
                      className={`text-xs px-3 py-1.5 rounded-md font-semibold transition ${
                        filterMode === 'favorites'
                          ? 'bg-white text-on-surface shadow-sm'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      Favorites (
                      {
                        frequentCombos.filter((c) => favoriteKeys.has(c.key))
                          .length
                      }
                      )
                    </button>
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`text-xs px-3 py-1.5 rounded-md font-semibold transition ${
                        filterMode === 'all'
                          ? 'bg-white text-on-surface shadow-sm'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      All (
                      {
                        frequentCombos.filter((c) => !archivedKeys.has(c.key))
                          .length
                      }
                      )
                    </button>
                    <button
                      onClick={() => setFilterMode('archived')}
                      className={`text-xs px-3 py-1.5 rounded-md font-semibold transition ${
                        filterMode === 'archived'
                          ? 'bg-white text-on-surface shadow-sm'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      Archive (
                      {
                        frequentCombos.filter((c) => archivedKeys.has(c.key))
                          .length
                      }
                      )
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {visibleCombos.map((combo) => {
                    const showPicker = schedulingCombo === combo.key;
                    const badge =
                      combo.frequency >= 10
                        ? 'High Rotation'
                        : combo.frequency >= 5
                          ? 'Regular'
                          : null;

                    return (
                      <div
                        key={combo.key}
                        className="group bg-surface-bright border border-outline-variant p-4 rounded-xl hover:shadow-lg transition-all duration-300 relative"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(combo.key);
                          }}
                          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition z-10"
                        >
                          <span
                            className={`material-symbols-outlined text-sm ${
                              favoriteKeys.has(combo.key)
                                ? 'text-red-500'
                                : 'text-gray-400'
                            }`}
                            style={{
                              fontVariationSettings: favoriteKeys.has(combo.key)
                                ? "'FILL' 1"
                                : "'FILL' 0",
                            }}
                          >
                            favorite
                          </span>
                        </button>
                        <ComboImageGrid items={combo.items} />
                        <div className="flex justify-between items-start mb-4 mt-4">
                          <div>
                            <h4 className="font-semibold text-base text-on-surface">
                              {combo.name ||
                                combo.items.map((i) => i.name).join(' + ')}
                            </h4>
                            <p className="text-sm text-on-surface-variant mt-1">
                              Worn {combo.frequency} times
                              {combo.days_since_worn <= 30
                                ? ' this month'
                                : ` · Last: ${combo.days_since_worn}d ago`}
                            </p>
                          </div>
                          {badge && (
                            <span className="bg-surface-container-high px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter shrink-0">
                              {badge}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            setSchedulingCombo(showPicker ? null : combo.key)
                          }
                          className="w-full border border-primary text-primary text-sm py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-primary hover:text-on-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">
                            calendar_month
                          </span>
                          Schedule Weekly
                        </button>
                        {showPicker && (
                          <MiniCalendarPicker
                            items={combo.items}
                            onScheduled={() => {
                              setSchedulingCombo(null);
                              refreshPlans();
                            }}
                          />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleArchive(combo.key);
                          }}
                          className="absolute top-3 left-3 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500 transition-all z-10"
                        >
                          <span className="material-symbols-outlined text-sm">
                            archive
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* AI Discovery */}
            {(bentoItem || secondaryItems.length > 0) && (
              <section
                className={`transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-on-surface font-headline">
                    AI Discovery
                  </h2>
                  <span className="text-sm text-on-surface-variant">
                    Fresh pairings from your closet
                  </span>
                </div>

                <div className="space-y-6">
                  {bentoItem && (
                    <div className="bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden flex flex-col md:flex-row">
                      <div className="md:w-1/2 p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="material-symbols-outlined text-primary text-sm"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              auto_awesome
                            </span>
                            <span className="text-xs font-bold uppercase tracking-widest text-primary">
                              {bentoItem.source === 'suggestion'
                                ? bentoItem.style === 'adventurous'
                                  ? 'Adventurous Mix'
                                  : 'Safe Pick'
                                : 'New Combo'}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold text-on-surface mb-2 font-headline">
                            {bentoItem.title}
                          </h4>
                          <p className="text-sm text-on-surface-variant leading-relaxed">
                            {bentoItem.reason}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {[
                              ...new Set(
                                bentoItem.items.flatMap(
                                  (i) => i.use_case || [],
                                ),
                              ),
                            ]
                              .slice(0, 3)
                              .map((uc, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-bold uppercase tracking-wider bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded"
                                >
                                  {uc}
                                </span>
                              ))}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                              {bentoItem.items.slice(0, 2).map((item, i) => (
                                <div
                                  key={i}
                                  className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-surface-variant"
                                >
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div
                                      className="w-full h-full"
                                      style={{
                                        backgroundColor:
                                          item.color || '#c7c6c6',
                                      }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                                Impact Score
                              </p>
                              <p className="text-sm font-black text-on-surface">
                                +{bentoItem.score} XP
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              router.push(
                                `/planner?${itemsToPlannerParams(bentoItem.items)}`,
                              )
                            }
                            className="bg-primary text-on-primary px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
                          >
                            Try This
                          </button>
                        </div>
                      </div>
                      <div
                        className="md:w-1/2 bg-surface-variant relative min-h-[200px] cursor-pointer hover:opacity-90 transition"
                        onClick={() =>
                          router.push(
                            `/planner?${itemsToPlannerParams(bentoItem.items)}`,
                          )
                        }
                      >
                        <div className="absolute inset-0 p-4">
                          <div className="w-full h-full bg-surface-container rounded-lg overflow-hidden flex items-center gap-2 overflow-x-auto px-2 py-2">
                            {bentoItem.items.map((item, i) => (
                              <div
                                key={i}
                                className="h-[85%] aspect-[3/4] shrink-0 relative overflow-hidden rounded-lg"
                              >
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex flex-col items-center justify-center"
                                    style={{
                                      backgroundColor: item.color || '#e3e2e2',
                                    }}
                                  >
                                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                                      checkroom
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant mt-1 text-center px-1">
                                      {item.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {secondaryItems.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {secondaryItems.map((item, i) => (
                        <div
                          key={i}
                          onClick={() =>
                            router.push(
                              `/planner?${itemsToPlannerParams(item.items)}`,
                            )
                          }
                          className="bg-surface-bright border border-outline-variant p-4 rounded-xl flex items-center gap-4 group cursor-pointer hover:bg-surface-container-low transition-colors"
                        >
                          <div className="w-20 h-20 rounded-lg shrink-0 overflow-hidden grid grid-cols-2 gap-0.5">
                            {item.items.slice(0, 2).map((it, j) => (
                              <div key={j} className="relative overflow-hidden">
                                {it.image_url ? (
                                  <img
                                    src={it.image_url}
                                    alt={it.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center"
                                    style={{
                                      backgroundColor: it.color || '#e3e2e2',
                                    }}
                                  >
                                    <span className="material-symbols-outlined text-sm text-on-surface-variant">
                                      checkroom
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-semibold text-sm text-on-surface">
                              {item.title}
                            </h5>
                            <p className="text-xs text-on-surface-variant mt-1 truncate">
                              {item.reason}
                            </p>
                            <div className="flex gap-1 mt-2">
                              {item.items.slice(0, 2).map((it, j) => (
                                <div
                                  key={j}
                                  className="w-2 h-2 rounded-full"
                                  style={{
                                    backgroundColor: it.color || '#c7c6c6',
                                  }}
                                />
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {[
                                ...new Set(
                                  item.items.flatMap((it) => it.use_case || []),
                                ),
                              ]
                                .slice(0, 2)
                                .map((uc, j) => (
                                  <span
                                    key={j}
                                    className="text-[9px] font-bold uppercase tracking-wider bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded"
                                  >
                                    {uc}
                                  </span>
                                ))}
                            </div>
                          </div>
                          <span className="material-symbols-outlined ml-auto text-on-surface-variant group-hover:translate-x-1 transition-transform">
                            arrow_forward
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Empty State */}
            {!combosLoading && frequentCombos.length === 0 && (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block">
                  checkroom
                </span>
                <h2 className="text-lg font-semibold mb-2 font-headline text-on-surface">
                  No outfits yet
                </h2>
                <p className="text-sm text-on-surface-variant mb-4">
                  Start planning outfits to see your most-worn combos here.
                </p>
                <button
                  onClick={() => router.push('/planner')}
                  className="px-6 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition"
                >
                  Open Planner
                </button>
              </div>
            )}
          </div>

          {/* Right column — sidebar */}
          <div className="w-full lg:w-[340px] shrink-0 space-y-6">
            <PlannedOutfitsSidebar
              plans={plans as any}
              weather={weather}
              onSwap={handleQuickSwap}
              onPlan={handlePlanDay}
            />
            <StyleLabImpactMeter
              reactivatedCount={uniqueReactivated}
              totalSuggestedItems={totalSuggestedItems}
              weeklyChange={weeklyChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
