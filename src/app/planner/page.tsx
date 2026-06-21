'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Loader from '../components/Loader';
import SlotDropRow from '../components/SlotDropRow';
import Button from '../components/Button';
import OutfitSuggestionCard from '../components/OutfitSuggestionCard';
import toast from 'react-hot-toast';
import type { ClothingItem, OccasionKey, WeatherData, SuggestedOutfit } from '@/lib/suggestOutfits';

type OutfitSlotKey = 'top' | 'bottom' | 'onepiece' | 'outerwear';

interface SlotsState {
  top: ClothingItem | null;
  bottom: ClothingItem | null;
  onepiece: ClothingItem | null;
  outerwear: ClothingItem | null;
}

// Slot labels
const SLOT_LABELS: Record<OutfitSlotKey, string> = {
  top: 'Top',
  bottom: 'Bottoms',
  outerwear: 'Outerwear',
  onepiece: 'One-Piece',
};

// Category sorting priority (for left wardrobe)
const CATEGORY_ORDER: Record<string, number> = {
  Onepiece: 4,
  Bottoms: 2,
  Outerwear: 3,
  Tops: 1,
};

export default function PlannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [clothes, setClothes] = useState<ClothingItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [timeSlot, setTimeSlot] = useState<'day' | 'night'>('day');
  const [outfitName, setOutfitName] = useState('');

  const EMPTY_SLOTS: SlotsState = {
    top: null,
    bottom: null,
    onepiece: null,
    outerwear: null,
  };

  const [slots, setSlots] = useState<SlotsState>(EMPTY_SLOTS);
  const [urlReady, setUrlReady] = useState(false);

  // Suggestion panel state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [panelOccasion, setPanelOccasion] = useState<OccasionKey>('casual');
  const [panelSuggestions, setPanelSuggestions] = useState<SuggestedOutfit[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelSaving, setPanelSaving] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'suggestions' | 'complete'>('suggestions');
  const [panelWeather, setPanelWeather] = useState<WeatherData | null>(null);
  const [panelWeatherLoading, setPanelWeatherLoading] = useState(false);
  const weatherCache = useRef<Record<string, { data: WeatherData; ts: number }>>({});

  useEffect(() => {
    const qpDate = searchParams.get('date');
    const qpTimeSlot = searchParams.get('timeSlot');

    if (qpDate) setSelectedDate(qpDate);
    if (qpTimeSlot === 'day' || qpTimeSlot === 'night') setTimeSlot(qpTimeSlot);

    setUrlReady(true);
  }, [searchParams]);

  useEffect(() => {
    if (!urlReady) return;
    if (status !== 'authenticated') return;

    const controller = new AbortController();

    async function loadOutfit() {
      setSlots(EMPTY_SLOTS);

      try {
        const res = await fetch(
          `/api/outfit_plans?from=${selectedDate}&to=${selectedDate}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;

        const data = await res.json();
        const found = (data || []).find((o: any) => o.time_slot === timeSlot);

        if (!controller.signal.aborted) {
          setSlots(found?.slots ?? EMPTY_SLOTS);
          setOutfitName(found?.name ?? '');
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error(e);
      }
    }

    loadOutfit();
    return () => controller.abort();
  }, [urlReady, selectedDate, timeSlot, status]);

  // Fetch wardrobe items
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated') {
      fetchClothes();
    }
  }, [status]);

  const fetchClothes = async () => {
    try {
      const res = await fetch(`/api/clothes?user_id=${session?.user?.id}`);
      if (!res.ok) {
        console.error('Failed to fetch clothes for planner:', await res.text());
        setClothes([]);
      } else {
        const data = await res.json();
        if (Array.isArray(data)) {
          setClothes(data);
        } else {
          console.error('Invalid clothes response:', data);
          setClothes([]);
        }
      }
    } catch (err) {
      console.error('Error fetching clothes for planner:', err);
      setClothes([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of clothes) {
      if (c.type?.trim()) set.add(c.type.trim());
    }

    const arr = Array.from(set);
    arr.sort(
      (a, b) =>
        (CATEGORY_ORDER[a] ?? 999) - (CATEGORY_ORDER[b] ?? 999) ||
        a.localeCompare(b),
    );

    return ['All', ...arr];
  }, [clothes]);

  // Wardrobe sidebar list, sorted by category → favourite → name
  const sidebarClothes = useMemo(() => {
    if (!Array.isArray(clothes)) return [];

    const filtered =
      selectedCategory === 'All'
        ? clothes
        : clothes.filter((c) => (c.type ?? '').trim() === selectedCategory);

    const orderForType = (t?: string | null) =>
      t ? (CATEGORY_ORDER[t] ?? 999) : 999;

    return [...filtered].sort((a, b) => {
      const cat = orderForType(a.type) - orderForType(b.type);
      if (cat !== 0) return cat;

      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;

      return a.name.localeCompare(b.name);
    });
  }, [clothes, selectedCategory]);

  // Drag & drop: drop item onto slot
  const handleDrop = (slot: OutfitSlotKey, clothingId: string) => {
    const item = clothes.find((c) => c.id === clothingId);
    if (!item) return;

    setSlots((prev) => ({
      ...prev,
      [slot]: item,
    }));
  };

  const handleClearSlot = (slot: OutfitSlotKey) => {
    setSlots((prev) => ({
      ...prev,
      [slot]: null,
    }));
  };

  // Weather fetch when panel opens
  useEffect(() => {
    if (!showSuggestions) return;
    setPanelWeatherLoading(true);

    const cachedKey = 'planner_weather';
    try {
      const cached = weatherCache.current[cachedKey];
      if (cached && Date.now() - cached.ts < 30 * 60 * 1000) {
        setPanelWeather(cached.data);
        setPanelWeatherLoading(false);
        return;
      }
    } catch { /* ignore */ }

    fetch('https://api.open-meteo.com/v1/forecast?latitude=3.0061&longitude=101.6169&current_weather=true')
      .then(r => r.json())
      .then(data => {
        if (data?.current_weather) {
          const w: WeatherData = { temperature: data.current_weather.temperature, weathercode: data.current_weather.weathercode ?? 0 };
          setPanelWeather(w);
          weatherCache.current[cachedKey] = { data: w, ts: Date.now() };
        }
        setPanelWeatherLoading(false);
      })
      .catch(() => setPanelWeatherLoading(false));
  }, [showSuggestions]);

  // Compute suggestions via API when panel opens or occasion/weather/mode changes
  useEffect(() => {
    if (!showSuggestions) return;
    setPanelLoading(true);

    const seedIds = panelMode === 'complete'
      ? [slots.top?.id, slots.bottom?.id, slots.outerwear?.id, slots.onepiece?.id].filter(Boolean) as string[]
      : [];

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weather: panelWeather,
          occasion: panelOccasion,
          seedItemIds: seedIds,
        }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          if (!controller.signal.aborted) {
            setPanelSuggestions(Array.isArray(data) ? data : []);
          }
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') console.error('Suggestions fetch failed:', err);
        })
        .finally(() => {
          if (!controller.signal.aborted) setPanelLoading(false);
        });
    }, 80);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [showSuggestions, panelOccasion, panelWeather, slots, panelMode]);

  async function handleFillSuggestion(suggestion: SuggestedOutfit) {
    const key = suggestion.items.map(i => i.id).sort().join(',');
    setPanelSaving(key);
    try {
      const newSlots: SlotsState = { top: null, bottom: null, outerwear: null, onepiece: null };
      for (const item of suggestion.items) {
        if (item.type === 'Tops') newSlots.top = item;
        else if (item.type === 'Bottoms') newSlots.bottom = item;
        else if (item.type === 'One-Piece') newSlots.onepiece = item;
        else if (item.type === 'Outerwear') newSlots.outerwear = item;
      }
      setSlots(newSlots);

      await fetch('/api/outfit_plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          timeSlot,
          slots: newSlots,
          name: outfitName || `${panelOccasion} suggestion`,
        }),
      });

      toast.success('Outfit applied!');
      setShowSuggestions(false);
    } catch {
      toast.error('Failed to save outfit');
    } finally {
      setPanelSaving(null);
    }
  }

  if (loading) {
    return <Loader message="Loading planner..." />;
  }

  async function handleSaveOutfit() {
    const toastId = toast.loading('Saving outfit...');

    try {
      const res = await fetch('/api/outfit_plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          timeSlot,
          slots,
          name: outfitName,
        }),
      });

      if (!res.ok) {
        toast.error('Failed to save outfit', { id: toastId });
        return;
      }

      toast.success(
        timeSlot === 'day' ? 'Day outfit saved!' : 'Night outfit saved!',
        { id: toastId },
      );
    } catch {
      toast.error('Network error', { id: toastId });
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#163422]">Plan My Outfit</h1>

          <div className="flex gap-6 border-b border-slate-200">
          {/* Wardrobe Tab */}
          <button
            onClick={() => router.push('/wardrobe')}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === '/wardrobe'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            {/* Closet Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="4" y="3" width="16" height="18" rx="1.5" />
              <line x1="12" y1="3" x2="12" y2="21" />
              <circle cx="9" cy="12" r="0.6" />
              <circle cx="15" cy="12" r="0.6" />
            </svg>
            Wardrobe
          </button>

          {/* Plan Outfit Tab */}
          <button
            onClick={() => router.push('/planner')}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === '/planner'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            {/* Pencil Note Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="4" y="4" width="11" height="16" rx="1.4" />
              <line x1="7" y1="8" x2="13" y2="8" />
              <line x1="7" y1="11" x2="12" y2="11" />
              <path d="M15.5 9.5l3.2-3.2a1.4 1.4 0 0 1 2 2l-3.2 3.2-2.4.4.4-2.4z" />
            </svg>
            Plan Outfit
          </button>

          {/* Calendar Tab */}
          <button
            onClick={() => router.push('/calendar')}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === '/calendar'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            {/* Calendar Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="3.5" y="5" width="17" height="15" rx="2" />
              <line x1="3.5" y1="9" x2="20.5" y2="9" />
              <line x1="9" y1="3" x2="9" y2="7" />
              <line x1="15" y1="3" x2="15" y2="7" />
              <circle cx="9" cy="13" r="0.7" />
              <circle cx="15" cy="13" r="0.7" />
              <circle cx="9" cy="17" r="0.7" />
              <circle cx="15" cy="17" r="0.7" />
            </svg>
            Calendar
          </button>
        </div>
      </div>
    </div>

    <div className="px-6 pb-16 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        {/* Date picker */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Outfit Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white text-black shadow-sm"
          />
        </div>

        {/* Day/Night toggle */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Time Slot
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTimeSlot('day')}
              className={`px-4 py-2 rounded-xl border text-sm transition inline-flex items-center gap-1.5 ${
                timeSlot === 'day'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-slate-200 hover:bg-slate-50'
              }`}
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="10" r="3.5" />
                <line x1="10" y1="1" x2="10" y2="3" />
                <line x1="10" y1="17" x2="10" y2="19" />
                <line x1="1" y1="10" x2="3" y2="10" />
                <line x1="17" y1="10" x2="19" y2="10" />
                <line x1="3.5" y1="3.5" x2="4.9" y2="4.9" />
                <line x1="15.1" y1="15.1" x2="16.5" y2="16.5" />
                <line x1="3.5" y1="16.5" x2="4.9" y2="15.1" />
                <line x1="15.1" y1="4.9" x2="16.5" y2="3.5" />
              </svg>
              <span>Day</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeSlot('night')}
              className={`px-4 py-2 rounded-xl border text-sm transition inline-flex items-center gap-1.5 ${
                timeSlot === 'night'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-slate-200 hover:bg-slate-50'
              }`}
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 10.7a8 8 0 0 1-10.8-10.8A8.5 8.5 0 1 0 17.5 10.7z" />
              </svg>
              <span>Night</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT: wardrobe left, slots right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
        {/* LEFT: WARDROBE SIDEBAR */}
        <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 max-h-[80vh] overflow-hidden">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Wardrobe
          </h2>

          {/* Category pills + clothes grid */}
          <div className="flex flex-col h-[72vh]">
            {/* Horizontal category pills */}
            <div className="flex gap-1.5 mb-3 pb-3 overflow-x-auto border-b border-slate-200 shrink-0">
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      active
                        ? 'bg-black text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Clothes grid (filtered) */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sidebarClothes.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:border-black cursor-grab active:cursor-grabbing transition"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <div className="h-24 flex items-center justify-center text-xs text-slate-400">
                        No Image
                      </div>
                    )}

                    <div className="px-2 py-1">
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.type}
                      </p>
                      <p className="text-[12px] font-medium truncate">
                        {item.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {sidebarClothes.length === 0 && (
                <p className="text-sm text-slate-400 mt-4">
                  No items in this category.
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT: OUTFIT SLOTS */}
        <section className="space-y-4">
          {/* Outfit name input */}
          <div>
            <input
              type="text"
              placeholder="Name your outfit (optional)"
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-black placeholder:text-slate-400 focus:outline-none focus:border-black transition"
            />
          </div>

          {/* 2x2 grid of slot cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <SlotDropRow
                label={SLOT_LABELS.top}
                slotKey="top"
                item={slots.top}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />

              <SlotDropRow
                label={SLOT_LABELS.bottom}
                slotKey="bottom"
                item={slots.bottom}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />
            </div>

            <div className="space-y-6">
              <SlotDropRow
                label={SLOT_LABELS.outerwear}
                slotKey="outerwear"
                item={slots.outerwear}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />

              <SlotDropRow
                label={SLOT_LABELS.onepiece}
                slotKey="onepiece"
                item={slots.onepiece}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />
            </div>
          </div>

          {/* Save + suggest actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowSuggestions(true)}
              className="shimmer-btn text-sm px-5 py-2.5 rounded-xl bg-gradient-to-r from-zinc-800 via-zinc-900 to-black
                         text-white font-semibold shadow-md hover:shadow-lg
                         hover:scale-105 active:scale-95
                         transition-all duration-200 ease-out
                         flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="relative z-10">Suggest</span>
            </button>
            <Button size="md" onClick={handleSaveOutfit}>
              {timeSlot === 'day' ? 'Save Day' : 'Save Night'}
            </Button>
          </div>
        </section>

        {/* ── Inline Suggestion Panel ── */}
        {showSuggestions && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowSuggestions(false)} />
            <div className="relative ml-auto w-full max-w-md bg-white shadow-xl h-full overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
                <h2 className="text-lg font-semibold text-[#0f172a]">Outfit Suggestions</h2>
                <button onClick={() => setShowSuggestions(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
              </div>

              {/* Weather + Occasion */}
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  {panelWeatherLoading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-transparent rounded-full" />
                  ) : panelWeather ? (
                    <span className="text-sm font-medium text-slate-600">
                      {panelWeather.weathercode === 0 ? '☀️' : panelWeather.weathercode <= 3 ? '⛅' : '🌧️'} {Math.round(panelWeather.temperature)}°C
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['casual', 'business', 'formal', 'sport', 'date'] as OccasionKey[]).map(occ => (
                    <button
                      key={occ}
                      onClick={() => setPanelOccasion(occ)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        panelOccasion === occ
                          ? 'bg-[#0f172a] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {occ.charAt(0).toUpperCase() + occ.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode tabs */}
              <div className="mx-5 mt-4 flex gap-1.5">
                <button
                  onClick={() => setPanelMode('suggestions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    panelMode === 'suggestions'
                      ? 'bg-[#0f172a] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Fresh Suggestions
                </button>
                <button
                  onClick={() => setPanelMode('complete')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    panelMode === 'complete'
                      ? 'bg-[#0f172a] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Complete This Look
                </button>
              </div>

              {/* Seed banner (complete mode only) */}
              {panelMode === 'complete' && [slots.top?.id, slots.bottom?.id, slots.outerwear?.id, slots.onepiece?.id].some(Boolean) && (
                <div className="mx-5 mt-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  🔧 {[slots.top?.id, slots.bottom?.id, slots.outerwear?.id, slots.onepiece?.id].filter(Boolean).length} item(s) locked in — suggestions will include your current selections
                </div>
              )}

              {/* Suggestions */}
              <div className="px-5 py-4 space-y-4">
                {panelLoading ? (
                  <div className="flex justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-[#163422] rounded-full" />
                      <p className="text-sm text-slate-400">Finding the best combos...</p>
                    </div>
                  </div>
                ) : panelSuggestions.length === 0 ? (
                  <p className="text-slate-500 text-center py-16 text-sm">
                    No suggestions found — try a different occasion or add more items to your wardrobe.
                  </p>
                ) : (
                  panelSuggestions.map((s, i) => (
                    <OutfitSuggestionCard
                      key={`${s.palette}_${i}`}
                      suggestion={s}
                      saving={panelSaving === s.items.map(it => it.id).sort().join(',')}
                      onUse={() => handleFillSuggestion(s)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
