'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useWeather } from '@/hooks/queries/weather';
import { useClothes } from '@/hooks/queries/wardrobe';
import Loader from '../components/Loader';
import OutfitSuggestionCard from '../components/OutfitSuggestionCard';
import type { ClothingItem, SuggestedOutfit } from '@/lib/suggestOutfits';
import type { WeatherData } from '@/hooks/queries/weather';

type OccasionKey = 'casual' | 'business' | 'formal' | 'sport' | 'date';

const OCCASIONS: { key: OccasionKey; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'business', label: 'Business' },
  { key: 'formal', label: 'Formal' },
  { key: 'sport', label: 'Sport' },
  { key: 'date', label: 'Date' },
];

function weatherEmoji(code: number): string {
  if (code === 0) return '\u2600\uFE0F';
  if (code <= 3) return '\u26C5';
  if (code <= 48) return '\uD83C\uDF2B\uFE0F';
  if (code <= 65) return '\uD83C\uDF27\uFE0F';
  if (code <= 75) return '\u2744\uFE0F';
  return '\u26C8\uFE0F';
}

interface SlotsState {
  top: ClothingItem | null;
  bottom: ClothingItem | null;
  onepiece: ClothingItem | null;
  outerwear: ClothingItem | null;
}

function clothingToSlots(items: ClothingItem[]): SlotsState {
  const slots: SlotsState = { top: null, bottom: null, onepiece: null, outerwear: null };
  for (const item of items) {
    if (item.type === 'Tops') slots.top = item;
    else if (item.type === 'Bottoms') slots.bottom = item;
    else if (item.type === 'One-Piece') slots.onepiece = item;
    else if (item.type === 'Outerwear') slots.outerwear = item;
  }
  return slots;
}

export default function OutfitSuggestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: weatherResult, isLoading: weatherLoading } = useWeather(status === 'authenticated');
  const { data: clothesData, isLoading: clothesLoading } = useClothes(
    session?.user?.id,
  );
  const clothes = clothesData || [];
  const weather: WeatherData | null = weatherResult?.current ?? null;

  const [occasion, setOccasion] = useState<OccasionKey>('casual');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [seedItemIds, setSeedItemIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedOutfit[]>([]);

  useEffect(() => {
    const seed = searchParams.get('seed');
    if (seed) setSeedItemIds(seed.split(',').filter(Boolean));
  }, [searchParams]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  const allLoaded = !weatherLoading && !clothesLoading && status === 'authenticated';

  useEffect(() => {
    if (!allLoaded) return;
    setLoadingSuggestions(true);
    const controller = new AbortController();

    fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weather, occasion, seedItemIds }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setSuggestions(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error('Suggestions fetch failed:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSuggestions(false);
      });

    return () => controller.abort();
  }, [allLoaded, weather, occasion, seedItemIds]);

  const handleUseSuggestion = useCallback(
    async (suggestion: SuggestedOutfit, idx: number) => {
      setSavingIdx(idx);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const slots = clothingToSlots(suggestion.items);
        const plansRes = await fetch('/api/outfit_plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: today,
            time_slot: 'day',
            name: `${occasion} suggestion`,
            slots,
          }),
        });
        if (!plansRes.ok) throw new Error('Failed to save');
        toast.success('Outfit saved! Opening planner...');
        router.push(`/planner?date=${today}`);
      } catch {
        toast.error('Failed to save outfit');
      } finally {
        setSavingIdx(null);
      }
    },
    [occasion, router],
  );

  if (status === 'loading') {
    return <Loader message="Loading..." />;
  }

  const weatherCondition = weather?.description ?? null;
  const weatherEmojiStr = weather ? weatherEmoji(weather.weathercode) : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <button
        onClick={() => router.push('/planner')}
        className="text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        ← Back to Planner
      </button>

      <h1 className="text-3xl font-bold mb-8 text-[#0f172a]">Outfit Suggestions</h1>

      {/* Top bar: weather + occasion */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm min-w-[200px]">
          {weatherLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-transparent rounded-full" />
              Getting weather...
            </div>
          ) : weather ? (
            <span className="group relative flex items-center gap-3 cursor-pointer">
              <span className="text-2xl">{weatherEmojiStr}</span>
              <div>
                <p className="text-lg font-semibold text-slate-800">
                  {Math.round(weather.temperature)}°C
                </p>
                <p className="text-xs text-slate-500">{weatherCondition}</p>
              </div>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                <p className="font-medium">{weather.description}</p>
                <p className="text-slate-300">{Math.round(weather.temperature)}°C{weather.feelsLike != null ? ` · Feels ${Math.round(weather.feelsLike)}°C` : ''}</p>
                <p className="text-slate-300">
                  {weather.humidity != null ? `Humidity ${weather.humidity}%` : ''}
                  {weather.humidity != null && weather.windSpeed != null ? ' · ' : ''}
                  {weather.windSpeed != null ? `Wind ${Math.round(weather.windSpeed)} km/h` : ''}
                </p>
              </div>
            </span>
          ) : (
            <p className="text-sm text-slate-400">Weather unavailable</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {OCCASIONS.map((occ) => (
            <button
              key={occ.key}
              onClick={() => setOccasion(occ.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                occasion === occ.key
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {occ.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seed mode banner */}
      {seedItemIds.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center gap-2">
          <span>🔧</span>
          Completing your outfit — <strong>{seedItemIds.length} item{seedItemIds.length > 1 ? 's' : ''}</strong> locked in.
          Suggestions will always include your selected pieces.
          <button
            onClick={() => { setSeedItemIds([]); router.replace('/outfit-suggest'); }}
            className="ml-auto text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
          >
            Start fresh
          </button>
        </div>
      )}

      {/* Content area */}
      {clothesLoading ? (
        <Loader message="Loading your wardrobe..." />
      ) : clothes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500 mb-4">Your wardrobe is empty</p>
          <button
            onClick={() => router.push('/wardrobe/upload')}
            className="px-6 py-2.5 rounded-lg bg-[#163422] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Add your first item
          </button>
        </div>
      ) : !allLoaded || loadingSuggestions ? (
        <Loader message={loadingSuggestions ? 'Finding the best combos...' : 'Preparing suggestions...'} />
      ) : suggestions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500">
            No outfit combos found — try a different occasion or add more items to your wardrobe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suggestions.map((s, i) => (
            <OutfitSuggestionCard
              key={`${s.palette}_${i}`}
              suggestion={s}
              saving={savingIdx === i}
              onUse={() => handleUseSuggestion(s, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
