'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClothes } from '@/hooks/queries/wardrobe';
import { useOutfitPlans } from '@/hooks/queries/calendar';
import Loader from '../components/Loader';
import SlotDropRow from '../components/SlotDropRow';
import Button from '../components/Button';
import OutfitSuggestionCard from '../components/OutfitSuggestionCard';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';
import type { ClothingItem, OccasionKey, WeatherData, SuggestedOutfit } from '@/lib/suggestOutfits';
import { hasCompatibleUseCases, hasCompatibleSeasons } from '@/lib/suggestOutfits';

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
  const searchParams = useSearchParams();

  const { data: clothesData, isLoading: clothesLoading } = useClothes(session?.user?.id);
  const clothes = clothesData || [];
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
  const [planId, setPlanId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const WMO_LABELS: Record<number, string> = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Foggy',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
    95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
  };

  const weatherEmoji = (code: number) => {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 65) return '🌧️';
    if (code <= 75) return '❄️';
    return '⛈️';
  };

  useEffect(() => {
    const qpDate = searchParams.get('date');
    const qpTimeSlot = searchParams.get('timeSlot');
    const qpTop = searchParams.get('top');
    const qpBottom = searchParams.get('bottom');
    const qpOuterwear = searchParams.get('outerwear');
    const qpOnepiece = searchParams.get('onepiece');

    if (qpDate) setSelectedDate(qpDate);
    if (qpTimeSlot === 'day' || qpTimeSlot === 'night') setTimeSlot(qpTimeSlot);

    // Store item IDs for pre-filling after clothes load
    if (qpTop || qpBottom || qpOuterwear || qpOnepiece) {
      (window as any).__prefillSlots = {
        top: qpTop,
        bottom: qpBottom,
        outerwear: qpOuterwear,
        onepiece: qpOnepiece,
      };
    }

    setUrlReady(true);
  }, [searchParams]);

  const { data: outfitPlans } = useOutfitPlans(selectedDate, selectedDate);

  useEffect(() => {
    if (!urlReady) return;
    if (outfitPlans === undefined) return;

    const found = outfitPlans.find((o: any) => o.time_slot === timeSlot);
    setSlots((found?.slots ?? EMPTY_SLOTS) as SlotsState);
    setOutfitName(found?.name ?? '');
    setPlanId(found?.id ?? null);
  }, [urlReady, outfitPlans, timeSlot]);

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Pre-fill slots from URL params (after clothes are loaded)
  useEffect(() => {
    const prefill = (window as any).__prefillSlots;
    if (!prefill || clothes.length === 0) return;
    delete (window as any).__prefillSlots;

    const findItem = (id: string | null) => {
      if (!id) return null;
      return clothes.find((c) => c.id === id) || null;
    };

    setSlots({
      top: findItem(prefill.top),
      bottom: findItem(prefill.bottom),
      outerwear: findItem(prefill.outerwear),
      onepiece: findItem(prefill.onepiece),
    });
  }, [clothes]);

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

    // Check use-case and season compatibility with all other filled slots
    const filled = Object.entries(slots).filter(([key, val]) => key !== slot && val !== null) as [OutfitSlotKey, ClothingItem][];
    for (const [, otherItem] of filled) {
      if (!hasCompatibleUseCases(item, otherItem)) {
        const itemCases = item.use_case?.join(', ') || 'unknown';
        const otherCases = otherItem.use_case?.join(', ') || 'unknown';
        toast.error(
          `Incompatible combination: "${item.name}" (${itemCases}) doesn't go with "${otherItem.name}" (${otherCases})`
        );
        return;
      }
      if (!hasCompatibleSeasons(item, otherItem)) {
        toast.error(
          `Season mismatch: "${item.name}" (${item.season || 'All'}) doesn't go with "${otherItem.name}" (${otherItem.season || 'All'})`
        );
        return;
      }
    }

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

  // Weather fetch when panel opens — forecast for selected date
  useEffect(() => {
    if (!showSuggestions) return;
    setPanelWeatherLoading(true);

    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = selectedDate === todayStr;

    const cachedKey = `planner_weather_${selectedDate}`;
    try {
      const cached = weatherCache.current[cachedKey];
      if (cached && Date.now() - cached.ts < 30 * 60 * 1000) {
        setPanelWeather(cached.data);
        setPanelWeatherLoading(false);
        return;
      }
    } catch { /* ignore */ }

    const controller = new AbortController();

    const fetchWeatherByCoords = async (latitude: number, longitude: number) => {
      if (controller.signal.aborted) return;
      const base = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}`;

      const url = isToday
        ? `${base}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`
        : `${base}&daily=temperature_2m_max,temperature_2m_min,weather_code,apparent_temperature_max,wind_speed_10m_max,relative_humidity_2m_mean&start_date=${selectedDate}&end_date=${selectedDate}`;

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        if (controller.signal.aborted) return;
        let w: WeatherData | null = null;

        if (isToday && data?.current) {
          const c = data.current;
          w = {
            temperature: c.temperature_2m,
            weathercode: c.weather_code ?? 0,
            description: WMO_LABELS[c.weather_code] ?? 'Unknown',
            humidity: c.relative_humidity_2m,
            feelsLike: c.apparent_temperature,
            windSpeed: c.wind_speed_10m,
          };
        } else if (!isToday && data?.daily?.time?.length > 0) {
          const d = data.daily;
          const i = d.time.indexOf(selectedDate);
          if (i !== -1) {
            w = {
              temperature: Math.round((d.temperature_2m_max[i] + d.temperature_2m_min[i]) / 2),
              weathercode: d.weather_code[i] ?? 0,
              description: WMO_LABELS[d.weather_code[i]] ?? 'Unknown',
              humidity: d.relative_humidity_2m_mean?.[i],
              feelsLike: d.apparent_temperature_max?.[i],
              windSpeed: d.wind_speed_10m_max?.[i],
            };
          }
        }

        if (w) {
          setPanelWeather(w);
          weatherCache.current[cachedKey] = { data: w, ts: Date.now() };
        } else if (!isToday) {
          setPanelWeather(null);
        }
        if (!controller.signal.aborted) setPanelWeatherLoading(false);
      } catch {
        if (!controller.signal.aborted) {
          if (!isToday) setPanelWeather(null);
          setPanelWeatherLoading(false);
        }
      }
    };

    const fallbackToIpLocation = async () => {
      try {
        const res = await fetch('http://ip-api.com/json/', { signal: controller.signal });
        if (!res.ok) throw new Error('IP geolocation failed');
        const data = await res.json();
        if (data?.lat && data?.lon) {
          await fetchWeatherByCoords(data.lat, data.lon);
        } else {
          throw new Error('No coords from IP');
        }
      } catch {
        if (!controller.signal.aborted) {
          if (!isToday) setPanelWeather(null);
          setPanelWeatherLoading(false);
        }
      }
    };

    if (!('geolocation' in navigator)) {
      fallbackToIpLocation();
      return () => controller.abort();
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (controller.signal.aborted) return;
        fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
      },
      () => {
        fallbackToIpLocation();
      },
    );

    return () => controller.abort();
  }, [showSuggestions, selectedDate]);

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

  if (clothesLoading) {
    return <Loader message="Loading planner..." />;
  }

  async function handleDeleteOutfit() {
    if (!planId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/outfit_plans/${planId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error('Failed to delete outfit');
        return;
      }
      toast.success('Outfit deleted');
      setPlanId(null);
      setSlots(EMPTY_SLOTS);
      setOutfitName('');
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
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
    <div className="min-h-screen">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-[#163422] font-headline">Plan My Outfit</h1>
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
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 font-headline">
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
            {planId && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition font-medium"
              >
                Delete
              </button>
            )}
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
                <h2 className="text-lg font-semibold text-[#0f172a] font-headline">Outfit Suggestions</h2>
                <button onClick={() => setShowSuggestions(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
              </div>

              {/* Weather + Occasion */}
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  {panelWeatherLoading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-transparent rounded-full" />
                  ) : panelWeather ? (
                    <span className="group relative text-sm font-medium text-slate-600 cursor-pointer">
                      {weatherEmoji(panelWeather.weathercode)} {Math.round(panelWeather.temperature)}°C
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                        <p className="font-medium">{panelWeather.description}</p>
                        <p className="text-slate-300">{Math.round(panelWeather.temperature)}°C{panelWeather.feelsLike != null ? ` · Feels ${Math.round(panelWeather.feelsLike)}°C` : ''}</p>
                        <p className="text-slate-300">
                          {panelWeather.humidity != null ? `Humidity ${panelWeather.humidity}%` : ''}
                          {panelWeather.humidity != null && panelWeather.windSpeed != null ? ' · ' : ''}
                          {panelWeather.windSpeed != null ? `Wind ${Math.round(panelWeather.windSpeed)} km/h` : ''}
                        </p>
                      </div>
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
      <ConfirmModal
        open={confirmDelete}
        title="Delete outfit?"
        message="This will remove the outfit plan and its wear logs. Wear counts for these items will be reduced."
        confirmLabel="Delete"
        onConfirm={handleDeleteOutfit}
        onCancel={() => setConfirmDelete(false)}
        loading={deleting}
      />
    </div>
  );
}
