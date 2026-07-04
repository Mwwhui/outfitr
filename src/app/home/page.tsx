'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWeather, getWeatherIcon } from '@/hooks/queries/weather';
import { useCalendarEvents } from '@/hooks/queries/calendar';
import {
  useMonthlyInsights,
  useOutfitSuggestion,
  usePledges,
  useSustainabilityStory,
} from '@/hooks/queries/home';
import TodaysEnsemble from '../components/home/TodaysEnsemble';
import ActionRequired from '../components/home/ActionRequired';
import MonthlyStory from '../components/home/MonthlyStory';
import SmartShoppingList from '../components/home/SmartShoppingList';
import SeasonalReadiness from '../components/home/SeasonalReadiness';
import CircularityScore from '../components/home/CircularityScore';
import SustainabilityStory from '../components/home/SustainabilityStory';
import WardrobeAnalytics from '../components/home/WardrobeAnalytics';
import WeatherAlert from '../components/home/WeatherAlert';
import TodayEvents from '../components/home/TodayEvents';
import OutfitFeedback from '../components/home/OutfitFeedback';

function getTimeSlot(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function detectOccasionFromEvents(
  events: {
    id: string;
    summary: string;
    start: string;
    end: string;
    allDay: boolean;
  }[],
): string {
  const text = events.map((e) => e.summary.toLowerCase()).join(' ');
  if (/wedding|gala|black.tie|formal|ceremony|banquet/.test(text))
    return 'formal';
  if (/meeting|interview|presentation|conference|client|pitch/.test(text))
    return 'business';
  if (/date|dinner|anniversary|proposal/.test(text)) return 'date';
  if (/gym|workout|run|race|yoga|pilates|training/.test(text)) return 'sport';
  if (/party|birthday|celebration|night.out|club/.test(text)) return 'date';
  return '';
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

  // Hooks
  const { data: weatherData, isLoading: weatherLoading } = useWeather(status === 'authenticated');
  const { data: calendar, isLoading: calendarLoading } = useCalendarEvents(session?.user?.id);
  const {
    data: insights,
    isLoading: insightsLoading,
    error: insightsError,
  } = useMonthlyInsights(session?.user?.id);

  const detectedOccasion = useMemo(() => {
    if (!calendar)
      return getTimeSlot() === 'evening'
        ? 'formal'
        : getTimeSlot() === 'afternoon'
          ? 'business'
          : 'casual';
    const fromCalendar = detectOccasionFromEvents(calendar.events);
    return (
      fromCalendar ||
      (getTimeSlot() === 'evening'
        ? 'formal'
        : getTimeSlot() === 'afternoon'
          ? 'business'
          : 'casual')
    );
  }, [calendar]);

  const { data: outfit } = useOutfitSuggestion(
    detectedOccasion,
    weatherData?.current ?? null,
    session?.user?.id,
  );
  const { data: pledgesData } = usePledges(session?.user?.id);
  const { data: sustainability } = useSustainabilityStory(session?.user?.id);

  // Local state only
  const [loggingWear, setLoggingWear] = useState(false);
  const [outfitFeedback, setOutfitFeedback] = useState<{
    weather: { temp: number; condition: string } | null;
    occasion: string;
    score: number;
    wearCount: number;
  } | null>(null);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  const loading =
    status === 'loading' ||
    insightsLoading ||
    weatherLoading ||
    calendarLoading;

  const handleLogWear = useCallback(async () => {
    if (!outfit?.items.length || loggingWear) return;
    setLoggingWear(true);
    try {
      const slots: Record<string, { id: string; name: string }> = {};
      outfit.items.forEach((item, i) => {
        slots[`slot_${i}`] = { id: item.id, name: item.name };
      });

      const res = await fetch('/api/outfit_plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          timeSlot: getTimeSlot(),
          slots,
          name: outfit.items.map((i) => i.name).join(' + '),
        }),
      });

      if (res.ok) {
        setOutfitFeedback({
          weather: weatherData?.current
            ? {
                temp: weatherData.current.temperature,
                condition: weatherData.current.description,
              }
            : null,
          occasion: detectedOccasion || getTimeSlot(),
          score: outfit.score || 0,
          wearCount: insights?.most_worn[0]?.total_wears || 0,
        });
      }
    } catch {
      // silently fail
    } finally {
      setLoggingWear(false);
    }
  }, [outfit, loggingWear, detectedOccasion, weatherData, insights]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
          <div className="h-12 bg-surface-variant rounded w-64 animate-pulse mb-2" />
          <div className="h-5 bg-surface-variant rounded w-80 animate-pulse" />
        </div>
        <div className="px-6 pb-16 max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <SkeletonCard />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  if (insightsError && !insights) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
            error
          </span>
          <h2 className="text-xl font-bold text-on-surface mb-2">
            Could not load your wardrobe
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">
            {insightsError.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-on-primary px-6 py-2.5 rounded text-sm font-semibold hover:opacity-90 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!insights || insights.insufficient_data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block">
            checkroom
          </span>
          <h2 className="text-2xl font-bold text-on-surface mb-3">
            Welcome to Outfitr
          </h2>
          <p className="text-on-surface-variant mb-6">
            Add at least 5 items to unlock your personalized wardrobe insights.
          </p>
          <Link
            href="/wardrobe/upload"
            className="inline-block bg-primary text-on-primary px-6 py-2.5 rounded text-sm font-semibold hover:opacity-90 transition"
          >
            Add Your First Items
          </Link>
        </div>
      </div>
    );
  }

  const health = insights.wardrobe_health;
  const overallHealth = Math.round(
    (health.category_balance_score + health.color_diversity_score) / 2,
  );

  const outfitName = outfit?.items.map((i) => i.name).join(' + ') || null;
  const outfitDescription = outfit?.ai_reasoning || null;
  const outfitItems = outfit?.items || [];
  const outfitTags = outfit?.items.map((i) => i.type) || [];

  const topWornItem =
    insights.most_worn.length > 0 ? insights.most_worn[0] : null;

  const pledges = pledgesData?.pledges || [];
  const fallbackPartnerText = pledgesData?.fallback_partner_text || 'Partner';
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
            <p className="text-base text-on-surface-variant mt-2 font-body">
              {insights.summary}
            </p>
          )}
          <div className="flex flex-wrap gap-4 mt-3">
            {insights.fun_fact && (
              <span className="text-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">
                  lightbulb
                </span>
                {insights.fun_fact}
              </span>
            )}
            {insights.wear_streak_text && (
              <span className="text-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">
                  local_fire_department
                </span>
                {insights.wear_streak_text}
              </span>
            )}
            <span className="text-sm text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">
                checkroom
              </span>
              {insights.items_in_wardrobe_text}
            </span>
          </div>
        </section>

        <WeatherAlert alerts={weatherData?.alerts || []} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Today's Ensemble */}
          <div className="lg:col-span-8 space-y-6">
            {outfitName ? (
              <TodaysEnsemble
                items={outfitItems}
                outfitName={outfitName}
                description={outfitDescription || insights.empty_outfit_text}
                weather={
                  weatherData?.current
                    ? {
                        temp: weatherData.current.temperature,
                        condition: weatherData.current.description,
                        icon: getWeatherIcon(weatherData.current.weathercode),
                      }
                    : null
                }
                tags={outfitTags}
                onLogWear={handleLogWear}
                loggingWear={loggingWear}
              />
            ) : (
              <div className="glass-card rounded-lg p-6 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2">
                  checkroom
                </span>
                <p className="text-sm mb-3">{insights.empty_outfit_text}</p>
                <Link
                  href={insights.empty_outfit_cta}
                  className="inline-block bg-primary text-on-primary px-5 py-2 rounded text-sm font-semibold hover:opacity-90 transition"
                >
                  Add Items
                </Link>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-6">
            {calendar?.needsReconnect ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-600">
                  link_off
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    Calendar disconnected
                  </p>
                  <p className="text-xs text-amber-600">
                    Reconnect to see today&apos;s events
                  </p>
                </div>
                <Link
                  href="/api/integrations/google/start"
                  className="text-xs font-semibold text-amber-700 hover:underline whitespace-nowrap"
                >
                  Reconnect
                </Link>
              </div>
            ) : (
              <TodayEvents
                events={calendar?.events || []}
                suggestedOccasion={detectedOccasion || undefined}
              />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            {sustainability && (
              <SustainabilityStory
                story={sustainability.story}
                impact={sustainability.impact}
                sustainabilityRate={sustainability.sustainability_rate}
              />
            )}
          </div>
        </section>

        {/* Wardrobe Analytics */}
        <WardrobeAnalytics
          colors={insights.color_palette}
          categories={insights.category_balance}
          topWorn={insights.most_worn}
        />
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
