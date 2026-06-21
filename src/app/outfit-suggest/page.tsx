'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Loader from '../components/Loader';
import OutfitSuggestionCard from '../components/OutfitSuggestionCard';
import type { ClothingItem, SuggestedOutfit } from '@/lib/suggestOutfits';

type OccasionKey = 'casual' | 'business' | 'formal' | 'sport' | 'date';

const OCCASIONS: { key: OccasionKey; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'business', label: 'Business' },
  { key: 'formal', label: 'Formal' },
  { key: 'sport', label: 'Sport' },
  { key: 'date', label: 'Date' },
];

const WMO_LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
};

const DEFAULT_LOCATION = { lat: 3.0061, lng: 101.6169 };
const WEATHER_TTL = 30 * 60 * 1000;

function getWeatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  return '⛈️';
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

function getCachedWeather<T>(lat: number, lng: number): T | null {
  try {
    const key = `weather_${lat.toFixed(1)}_${lng.toFixed(1)}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > WEATHER_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

function setCachedWeather<T>(lat: number, lng: number, data: T): void {
  try {
    const key = `weather_${lat.toFixed(1)}_${lng.toFixed(1)}`;
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    /* localStorage full or unavailable */
  }
}

function getCachedClothes(userId: string): ClothingItem[] | null {
  try {
    const raw = sessionStorage.getItem(`clothes_${userId}`);
    return raw ? (JSON.parse(raw) as ClothingItem[]) : null;
  } catch {
    return null;
  }
}

function setCachedClothes(userId: string, data: ClothingItem[]): void {
  try {
    sessionStorage.setItem(`clothes_${userId}`, JSON.stringify(data));
  } catch {
    /* sessionStorage full */
  }
}

export default function OutfitSuggestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [weather, setWeather] = useState<{ temperature: number; weathercode: number } | null>(null);
  const [occasion, setOccasion] = useState<OccasionKey>('casual');
  const [clothes, setClothes] = useState<ClothingItem[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [loadingClothes, setLoadingClothes] = useState(true);
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
      return;
    }
  }, [status, router]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLoc({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLoadingLocation(false);
        },
        () => {
          setUserLoc(DEFAULT_LOCATION);
          setLoadingLocation(false);
        },
      );
    } else {
      setUserLoc(DEFAULT_LOCATION);
      setLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    if (!userLoc) return;
    setLoadingWeather(true);

    const cached = getCachedWeather<{ temperature: number; weathercode: number }>(
      userLoc.lat,
      userLoc.lng,
    );
    if (cached) {
      setWeather(cached);
      setLoadingWeather(false);
      return;
    }

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${userLoc.lat}&longitude=${userLoc.lng}&current_weather=true`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data?.current_weather) {
          const w = {
            temperature: data.current_weather.temperature,
            weathercode: data.current_weather.weathercode ?? 0,
          };
          setWeather(w);
          setCachedWeather(userLoc.lat, userLoc.lng, w);
        }
        setLoadingWeather(false);
      })
      .catch(() => {
        setLoadingWeather(false);
      });
  }, [userLoc]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    setLoadingClothes(true);

    const cached = getCachedClothes(session.user.id);
    if (cached) {
      setClothes(cached);
      setLoadingClothes(false);
    }

    fetch(`/api/clothes?user_id=${session.user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClothes(data);
          setCachedClothes(session.user.id, data);
        }
        setLoadingClothes(false);
      })
      .catch(() => {
        setLoadingClothes(false);
      });
  }, [status, session?.user?.id]);

  const allLoaded = !loadingLocation && !loadingWeather && !loadingClothes;

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
  }, [allLoaded, weather, occasion, seedItemIds, seedItemIds.length]);

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

  const weatherCondition = weather ? WMO_LABELS[weather.weathercode] ?? 'Unknown' : null;
  const weatherEmoji = weather ? getWeatherEmoji(weather.weathercode) : null;

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
          {loadingLocation || loadingWeather ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-transparent rounded-full" />
              Getting weather...
            </div>
          ) : weather ? (
            <>
              <span className="text-2xl">{weatherEmoji}</span>
              <div>
                <p className="text-lg font-semibold text-slate-800">
                  {Math.round(weather.temperature)}°C
                </p>
                <p className="text-xs text-slate-500">{weatherCondition}</p>
              </div>
            </>
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
      {loadingClothes ? (
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
