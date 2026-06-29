'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TodaysEnsemble from '../components/home/TodaysEnsemble';
import ActionRequired from '../components/home/ActionRequired';
import MonthlyStory from '../components/home/MonthlyStory';
import SmartShoppingList from '../components/home/SmartShoppingList';
import SeasonalReadiness from '../components/home/SeasonalReadiness';
import CircularityScore from '../components/home/CircularityScore';
import WardrobeAnalytics from '../components/home/WardrobeAnalytics';
import WeatherAlert from '../components/home/WeatherAlert';
import TodayEvents from '../components/home/TodayEvents';
import OutfitFeedback from '../components/home/OutfitFeedback';

interface InsightsData {
  greeting: string;
  headline: string;
  month_theme: string;
  summary: string;
  fun_fact: string;
  wear_streak: number;
  wear_streak_text: string;
  items_in_wardrobe_text: string;
  cost_per_wear_trend_text: string;
  empty_outfit_text: string;
  empty_outfit_cta: string;
  insufficient_items_text: string;
  insufficient_items_cta: string;
  error_title: string;
  error_button: string;
  wear_more: Array<{
    item_id: string;
    name: string;
    image_url: string | null;
    type: string;
    reason: string;
    suggested_combo: string;
    times_worn_this_month: number;
    total_wears: number;
  }>;
  most_worn: Array<{
    item_id: string;
    name: string;
    image_url: string | null;
    type: string;
    times_worn_this_month: number;
    total_wears: number;
  }>;
  shopping_list: Array<{
    item_type: string;
    color: string;
    reason: string;
    search_query: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  seasonal_tip: {
    season: string;
    next_season: string;
    tip: string;
    missing_types: string[];
    coverage_pct: number;
    coverage_detail: string;
    missing_tooltips: Array<{ type: string; suggestion: string; reason: string }>;
    transition_tip: string;
  };
  wardrobe_health: {
    total_items: number;
    items_worn_this_month: number;
    category_balance_score: number;
    color_diversity_score: number;
    cost_per_wear: number;
    cost_per_wear_trend: 'up' | 'down' | 'stable';
    score_breakdown: {
      category_balance: { score: number; detail: string; suggestion: string };
      color_diversity: { score: number; detail: string; suggestion: string };
    };
  };
  color_palette: Array<{ color: string; hex: string | null; count: number; pct: number }>;
  category_balance: Array<{ type: string; count: number; ideal: number; pct: number }>;
}

interface OutfitSuggestion {
  items: Array<{
    id: string;
    name: string;
    type: string;
    color: string | null;
    image_url: string | null;
  }>;
  score: number;
  ai_reasoning: string;
}

interface WeatherData {
  temperature: number;
  weathercode: number;
  description: string;
}

interface PledgeData {
  id: string;
  action_type: string;
  status: string;
  label: string;
  progress_pct: number;
  status_text: string;
  partner_name: string | null;
  item_count: number;
  items: Array<{ id: string; name: string; image_url: string | null }>;
  created_at: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface WeatherAlert {
  type: 'rain' | 'temp_drop' | 'temp_rise' | 'extreme_heat' | 'wind';
  message: string;
  icon: string;
}

const WMO_LABELS: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
  55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 80: 'Slight rain showers',
  81: 'Moderate rain showers', 82: 'Violent rain showers', 85: 'Slight snow showers',
  86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail',
  99: 'Heavy thunderstorm with hail',
};

function getWeatherIcon(code: number): string {
  if (code <= 1) return 'clear_day';
  if (code <= 3) return 'partly_cloudy_day';
  if (code <= 48) return 'foggy';
  if (code <= 55) return 'rainy_light';
  if (code <= 65) return 'rainy';
  if (code <= 75) return 'weather_snowy';
  if (code <= 82) return 'rainy';
  if (code <= 86) return 'weather_snowy';
  if (code >= 95) return 'thunderstorm';
  return 'cloud';
}

function getTimeSlot(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function detectOccasionFromEvents(events: CalendarEvent[]): string {
  const text = events.map((e) => e.summary.toLowerCase()).join(' ');
  if (/wedding|gala|black.tie|formal|ceremony|banquet/.test(text)) return 'formal';
  if (/meeting|interview|presentation|conference|client|pitch/.test(text)) return 'business';
  if (/date|dinner|anniversary|proposal/.test(text)) return 'date';
  if (/gym|workout|run|race|yoga|pilates|training/.test(text)) return 'sport';
  if (/party|birthday|celebration|night.out|club/.test(text)) return 'date';
  return '';
}

function detectWeatherAlerts(hourly: { time: string; temp: number; code: number }[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const now = new Date();
  const currentHour = now.getHours();
  const future = hourly.filter((h) => new Date(h.time).getHours() > currentHour);

  // Rain alert
  const rainSoon = future.find((h) => h.code >= 51 && h.code <= 67);
  if (rainSoon) {
    const hour = new Date(rainSoon.time).getHours();
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour > 12 ? hour - 12 : hour;
    alerts.push({
      type: 'rain',
      message: `Rain expected at ${displayHour}${ampm} — don't forget an umbrella`,
      icon: 'umbrella',
    });
  }

  // Temperature drop alert
  if (hourly.length >= 2) {
    const current = hourly[0].temp;
    const evening = hourly[Math.min(hourly.length - 1, 12)].temp;
    if (current - evening >= 5) {
      alerts.push({
        type: 'temp_drop',
        message: `Temperature dropping to ${evening}°C this evening — grab a layer`,
        icon: 'thermometer',
      });
    }
  }

  // Extreme heat
  const maxTemp = Math.max(...hourly.map((h) => h.temp));
  if (maxTemp >= 32) {
    alerts.push({
      type: 'extreme_heat',
      message: `High of ${maxTemp}°C today — stay cool and hydrated`,
      icon: 'wb_sunny',
    });
  }

  return alerts;
}

function SkeletonCard() {
  return (
    <div className="bg-surface-container-low rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-surface-variant rounded w-1/3 mb-4" />
      <div className="h-20 bg-surface-variant rounded-xl mb-3" />
      <div className="h-3 bg-surface-variant rounded w-3/4" />
    </div>
  );
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outfitSuggestion, setOutfitSuggestion] = useState<OutfitSuggestion | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [pledges, setPledges] = useState<PledgeData[]>([]);
  const [fallbackPartnerText, setFallbackPartnerText] = useState('Partner');
  const [loggingWear, setLoggingWear] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [detectedOccasion, setDetectedOccasion] = useState<string>('');
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([]);
  const [calendarNeedsReconnect, setCalendarNeedsReconnect] = useState(false);
  const [outfitFeedback, setOutfitFeedback] = useState<{
    weather: { temp: number; condition: string } | null;
    occasion: string;
    score: number;
    wearCount: number;
  } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status !== 'authenticated') return;

    setLoading(true);
    setError(null);

    const fetchWeather = (): Promise<WeatherData | null> => {
      if (!('geolocation' in navigator)) return Promise.resolve(null);
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
            )
              .then((r) => r.json())
              .then((data) => {
                if (data?.current) {
                  resolve({
                    temperature: Math.round(data.current.temperature_2m),
                    weathercode: data.current.weather_code ?? 0,
                    description: WMO_LABELS[data.current.weather_code] ?? 'Unknown',
                  });
                } else {
                  resolve(null);
                }
              })
              .catch(() => resolve(null));
          },
          () => resolve(null),
        );
      });
    };

    const fetchHourlyWeather = (): Promise<{ time: string; temp: number; code: number }[] | null> => {
      if (!('geolocation' in navigator)) return Promise.resolve(null);
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=weather_code,temperature_2m&forecast_days=1`
            )
              .then((r) => r.json())
              .then((data) => {
                if (data?.hourly) {
                  const hourly = data.hourly.time.map((t: string, i: number) => ({
                    time: t,
                    temp: Math.round(data.hourly.temperature_2m[i]),
                    code: data.hourly.weather_code[i],
                  }));
                  resolve(hourly);
                } else {
                  resolve(null);
                }
              })
              .catch(() => resolve(null));
          },
          () => resolve(null),
        );
      });
    };

    const fetchCalendar = async (): Promise<{ events: CalendarEvent[]; connected: boolean; needsReconnect: boolean }> => {
      try {
        const statusRes = await fetch('/api/integrations/google/status');
        const status = await statusRes.json();
        if (!status.connected) return { events: [], connected: false, needsReconnect: false };

        const today = new Date().toISOString().slice(0, 10);
        const eventsRes = await fetch(`/api/integrations/google/events?date=${today}`);
        if (eventsRes.status === 401) {
          return { events: [], connected: true, needsReconnect: true };
        }
        if (!eventsRes.ok) {
          return { events: [], connected: true, needsReconnect: false };
        }
        const eventsData = await eventsRes.json();
        return { events: eventsData.events || [], connected: true, needsReconnect: false };
      } catch {
        return { events: [], connected: false, needsReconnect: false };
      }
    };

    Promise.all([fetchWeather(), fetchHourlyWeather(), fetchCalendar()])
      .then(([weatherData, hourlyData, calendarData]) => {
        if (weatherData) setWeather(weatherData);
        if (hourlyData) {
          const alerts = detectWeatherAlerts(hourlyData);
          setWeatherAlerts(alerts);
        }

        const occasionFromCalendar = detectOccasionFromEvents(calendarData.events);
        setCalendarEvents(calendarData.events);
        setDetectedOccasion(occasionFromCalendar);
        setCalendarNeedsReconnect(calendarData.needsReconnect);

        const finalOccasion = occasionFromCalendar || (getTimeSlot() === 'evening' ? 'formal' : getTimeSlot() === 'afternoon' ? 'business' : 'casual');

        return Promise.all([
          fetch('/api/wardrobe/monthly-insights').then(async (res) => {
            if (!res.ok) throw new Error('Failed to load insights');
            return res.json();
          }),
          fetch('/api/outfits/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              occasion: finalOccasion,
              weather: weatherData ? { temperature: weatherData.temperature, weathercode: weatherData.weathercode } : null,
            }),
          }).then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              return data.suggestions?.[0] || null;
            }
            return null;
          }).catch(() => null),
          fetch('/api/pledges').then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              return { pledges: data.pledges || [], fallback_partner_text: data.fallback_partner_text || 'Partner' };
            }
            return { pledges: [], fallback_partner_text: 'Partner' };
          }).catch(() => ({ pledges: [], fallback_partner_text: 'Partner' })),
        ]);
      })
      .then(([insightsData, outfitData, pledgesData]) => {
        if (insightsData.insufficient_data) {
          setInsights(null);
        } else {
          setInsights(insightsData);
        }
        setOutfitSuggestion(outfitData);
        setPledges(pledgesData.pledges);
        setFallbackPartnerText(pledgesData.fallback_partner_text);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [status, router]);

  const handleLogWear = useCallback(async () => {
    if (!outfitSuggestion?.items.length || loggingWear) return;
    setLoggingWear(true);
    try {
      const slots: Record<string, { id: string; name: string }> = {};
      outfitSuggestion.items.forEach((item, i) => {
        slots[`slot_${i}`] = { id: item.id, name: item.name };
      });

      const res = await fetch('/api/outfit_plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          timeSlot: getTimeSlot(),
          slots,
          name: outfitSuggestion.items.map((i) => i.name).join(' + '),
        }),
      });

      if (res.ok) {
        setInsights((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            wardrobe_health: {
              ...prev.wardrobe_health,
              items_worn_this_month: prev.wardrobe_health.items_worn_this_month + 1,
            },
          };
        });
        // Show outfit feedback
        setOutfitFeedback({
          weather: weather ? { temp: weather.temperature, condition: weather.description } : null,
          occasion: detectedOccasion || getTimeSlot(),
          score: outfitSuggestion.score || 0,
          wearCount: insights?.most_worn[0]?.total_wears || 0,
        });
      }
    } catch {
      // silently fail
    } finally {
      setLoggingWear(false);
    }
  }, [outfitSuggestion, loggingWear, detectedOccasion, weather, insights]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
          <div className="h-12 bg-surface-variant rounded w-64 animate-pulse mb-2" />
          <div className="h-5 bg-surface-variant rounded w-80 animate-pulse" />
        </div>
        <div className="px-6 pb-16 max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8"><SkeletonCard /></div>
            <div className="lg:col-span-4 space-y-6"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><SkeletonCard /><SkeletonCard /></div>
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">error</span>
          <h2 className="text-xl font-bold text-on-surface mb-2">{insights?.error_title || 'Could not load your wardrobe'}</h2>
          <p className="text-sm text-on-surface-variant mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-primary text-on-primary px-6 py-2.5 rounded text-sm font-semibold hover:opacity-90 transition">
            {insights?.error_button || 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block">checkroom</span>
          <h2 className="text-2xl font-bold text-on-surface mb-3">Welcome to Outfitr</h2>
          <p className="text-on-surface-variant mb-6">Add at least 5 items to unlock your personalized wardrobe insights.</p>
          <Link href="/wardrobe/upload" className="inline-block bg-primary text-on-primary px-6 py-2.5 rounded text-sm font-semibold hover:opacity-90 transition">
            Add Your First Items
          </Link>
        </div>
      </div>
    );
  }

  const health = insights.wardrobe_health;
  const overallHealth = Math.round((health.category_balance_score + health.color_diversity_score) / 2);

  const outfitName = outfitSuggestion?.items.map((i) => i.name).join(' + ') || null;
  const outfitDescription = outfitSuggestion?.ai_reasoning || null;
  const outfitItems = outfitSuggestion?.items || [];
  const outfitTags = outfitSuggestion?.items.map((i) => i.type) || [];

  const topWornItem = insights.most_worn.length > 0 ? insights.most_worn[0] : null;

  const acceptedPledges = pledges.filter((p) => p.status === 'accepted');
  const pendingPledges = pledges.filter((p) => p.status === 'pending');
  const topPledge = acceptedPledges[0] || pendingPledges[0] || null;

  const userName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 md:px-8 lg:px-12 py-8 max-w-[1280px] mx-auto space-y-12">
        {/* Greeting + Summary */}
        <section>
          <h1 className="text-3xl md:text-5xl font-bold text-on-surface font-headline tracking-tight">
            {insights.greeting}, {userName}.
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 font-body">
            {insights.month_theme}
          </p>
          <p className="text-lg text-on-surface-variant mt-2 font-body">
            {insights.headline}
          </p>
          {insights.summary && (
            <p className="text-base text-on-surface-variant mt-2 font-body">{insights.summary}</p>
          )}
          <div className="flex flex-wrap gap-4 mt-3">
            {insights.fun_fact && (
              <span className="text-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lightbulb</span>
                {insights.fun_fact}
              </span>
            )}
            {insights.wear_streak_text && (
              <span className="text-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">local_fire_department</span>
                {insights.wear_streak_text}
              </span>
            )}
            <span className="text-sm text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">checkroom</span>
              {insights.items_in_wardrobe_text}
            </span>
          </div>
        </section>

        <WeatherAlert alerts={weatherAlerts} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Today's Ensemble */}
          <div className="lg:col-span-8 space-y-6">
            {outfitName ? (
              <TodaysEnsemble
                items={outfitItems}
                outfitName={outfitName}
                description={outfitDescription || insights.empty_outfit_text}
                weather={weather ? { temp: weather.temperature, condition: weather.description, icon: getWeatherIcon(weather.weathercode) } : null}
                tags={outfitTags}
                onLogWear={handleLogWear}
                loggingWear={loggingWear}
              />
            ) : (
              <div className="glass-card rounded-lg p-6 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2">checkroom</span>
                <p className="text-sm mb-3">{insights.empty_outfit_text}</p>
                <Link href={insights.empty_outfit_cta} className="inline-block bg-primary text-on-primary px-5 py-2 rounded text-sm font-semibold hover:opacity-90 transition">
                  Add Items
                </Link>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-6">
            {calendarNeedsReconnect ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-600">link_off</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Calendar disconnected</p>
                  <p className="text-xs text-amber-600">Reconnect to see today&apos;s events</p>
                </div>
                <Link href="/api/integrations/google/start" className="text-xs font-semibold text-amber-700 hover:underline whitespace-nowrap">
                  Reconnect
                </Link>
              </div>
            ) : (
              <TodayEvents events={calendarEvents} suggestedOccasion={detectedOccasion || undefined} />
            )}

            {/* Action Required */}
            {topPledge && (
              <ActionRequired
                partnerName={topPledge.partner_name || fallbackPartnerText}
                status={topPledge.status}
                label={topPledge.label}
                actionType={topPledge.action_type}
                items={topPledge.items || []}
                createdAt={topPledge.created_at}
              />
            )}

            {/* Monthly Story */}
            {topWornItem && (
              <MonthlyStory
                itemName={topWornItem.name}
                itemImage={topWornItem.image_url}
                wearCount={topWornItem.times_worn_this_month}
                totalWears={topWornItem.total_wears}
                costPerWear={health.cost_per_wear}
                utilizationText={
                  health.cost_per_wear > 0
                    ? `Cost per wear: $${health.cost_per_wear.toFixed(2)} (${insights.cost_per_wear_trend_text})`
                    : undefined
                }
              />
            )}

            {/* Smart Shopping List */}
            {insights.shopping_list.length > 0 && (
              <SmartShoppingList items={insights.shopping_list} />
            )}
          </div>
        </div>

        {/* Wardrobe Wellness */}
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SeasonalReadiness
              coveragePct={insights.seasonal_tip.coverage_pct}
              missingTypes={insights.seasonal_tip.missing_types}
              tip={insights.seasonal_tip.tip}
              coverageDetail={insights.seasonal_tip.coverage_detail}
              missingTooltips={insights.seasonal_tip.missing_tooltips}
              transitionTip={insights.seasonal_tip.transition_tip}
            />
            <CircularityScore
              score={overallHealth}
              totalItems={health.total_items}
              itemsWornThisMonth={health.items_worn_this_month}
              scoreBreakdown={health.score_breakdown}
            />
          </div>
        </section>

        {/* Wardrobe Analytics */}
        <WardrobeAnalytics colors={insights.color_palette} categories={insights.category_balance} topWorn={insights.most_worn} />
      </div>

      {outfitFeedback && (
        <OutfitFeedback
          weather={outfitFeedback.weather}
          occasion={outfitFeedback.occasion}
          score={outfitFeedback.score}
          wearCount={outfitFeedback.wearCount}
          onDismiss={() => setOutfitFeedback(null)}
        />
      )}
    </div>
  );
}
