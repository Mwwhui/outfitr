'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useWeather, getWeatherIcon } from '@/hooks/queries/weather';
import { useCalendarEvents, useOutfitPlans } from '@/hooks/queries/calendar';
import { useCreateOutfitPlan } from '@/hooks/mutations/outfitPlans';
import {
  useMonthlyInsights,
  useOutfitSuggestion,
  usePledges,
  useSustainabilityStory,
  type OutfitSuggestion,
} from '@/hooks/queries/home';
import TodaysEnsemble from '../components/home/TodaysEnsemble';
import ActionRequired from '../components/home/ActionRequired';
import MonthlyStory from '../components/home/MonthlyStory';
import SmartShoppingList from '../components/home/SmartShoppingList';
import SeasonalReadiness from '../components/home/SeasonalReadiness';
import CircularityScore from '../components/home/CircularityScore';
import SustainabilityStory from '../components/home/SustainabilityStory';
import WardrobeAnalytics from '../components/home/WardrobeAnalytics';
import StreakCard from '../components/home/StreakCard';
import WeatherAlert from '../components/home/WeatherAlert';
import TodayEvents from '../components/home/TodayEvents';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';

function getTimeSlot(): string {
  const hour = new Date().getHours();
  if (hour < 18) return 'day';
  return 'night';
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
  const queryClient = useQueryClient();

  // Hooks
  const { data: weatherData, isLoading: weatherLoading } = useWeather(
    status === 'authenticated',
  );
  const { data: calendar, isLoading: calendarLoading } = useCalendarEvents(
    session?.user?.id,
  );
  const {
    data: insights,
    isLoading: insightsLoading,
    error: insightsError,
  } = useMonthlyInsights(session?.user?.id);

  const detectedOccasion = useMemo(() => {
    const defaultOccasion = getTimeSlot() === 'night' ? 'formal' : 'casual';
    if (!calendar) return defaultOccasion;
    return detectOccasionFromEvents(calendar.events) || defaultOccasion;
  }, [calendar]);

  const { data: outfit } = useOutfitSuggestion(
    detectedOccasion,
    weatherData?.current ?? null,
    session?.user?.id,
  );
  const { data: pledgesData } = usePledges(session?.user?.id);
  const { data: sustainability } = useSustainabilityStory(session?.user?.id);
  const logWearPlan = useCreateOutfitPlan(session?.user?.id);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: todayPlans, isFetching: plansFetching } = useOutfitPlans(
    session?.user?.id,
    today,
    today,
  );

  // Restore logged state only once on mount — never re-run on refetch
  const hasRestored = useRef(false);
  useEffect(() => {
    if (!todayPlans || !outfit || hasRestored.current) return;
    hasRestored.current = true;
    const currentSlot = getTimeSlot();
    const existingPlan = todayPlans.find((p) => p.time_slot === currentSlot);
    if (!existingPlan || !existingPlan.slots) return;

    const items = Object.values(existingPlan.slots).filter(Boolean) as Array<{
      id: string;
      name: string;
      image_url?: string | null;
      type?: string;
      color?: string | null;
    }>;

    if (items.length > 0) {
      setLoggedOutfit({
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          type: i.type || '',
          color: i.color || null,
          image_url: i.image_url || null,
        })),
        score: 0,
        ai_reasoning: existingPlan.name || 'Your logged outfit.',
      });
      setLoggedSlot(currentSlot as 'day' | 'night');
      setShowingLogged(true);
    }
  }, [todayPlans, outfit]);

  // Local state only
  const [loggingWear, setLoggingWear] = useState(false);
  const [loggedOutfit, setLoggedOutfit] = useState<OutfitSuggestion | null>(
    null,
  );
  const [loggedSlot, setLoggedSlot] = useState<'day' | 'night' | null>(null);
  const [nextOutfit, setNextOutfit] = useState<OutfitSuggestion | null>(null);
  const [showingLogged, setShowingLogged] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [showLogConfirm, setShowLogConfirm] = useState(false);
  // Synchronous guard against rapid double-clicks
  const loggingRef = useRef(false);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Sync: clear logged state if the plan was deleted from DB
  // (skips during background refetches to avoid placeholder data races)
  useEffect(() => {
    if (!todayPlans || !loggedSlot || !showingLogged || plansFetching) return;
    const planStillExists = todayPlans.some((p) => p.time_slot === loggedSlot);
    if (!planStillExists) {
      setLoggedOutfit(null);
      setLoggedSlot(null);
      setShowingLogged(false);
      setNextOutfit(null);
    }
  }, [todayPlans, loggedSlot, showingLogged, plansFetching]);

  // Only block on auth + calendar — AI/weather content loads progressively
  const loading = status === 'loading' || calendarLoading;

  const currentSlot = getTimeSlot();
  const nextSlotLabel = currentSlot === 'day' ? 'night' : null;

  const handleLogWear = useCallback(async () => {
    if (loggingRef.current) return;
    const isLoggingNext = !showingLogged && nextOutfit !== null;
    const outfitToLog = isLoggingNext ? nextOutfit : outfit;
    if (!outfitToLog?.items.length) return;
    loggingRef.current = true;
    setLoggingWear(true);
    try {
      const keyMap: Record<string, string> = {
        Tops: 'top',
        Bottoms: 'bottom',
        Outerwear: 'outerwear',
        'One-Piece': 'onepiece',
        Shoes: 'shoes',
        Accessories: 'accessories',
      };
      const slots: Record<string, Record<string, unknown>> = {};
      for (const item of outfitToLog.items) {
        const key = keyMap[item.type] || `slot_${Object.keys(slots).length}`;
        slots[key] = {
          id: item.id,
          name: item.name,
          type: item.type,
          color: item.color,
          image_url: item.image_url,
        };
      }

      const userId = session?.user?.id;
      const timeSlotToSave =
        isLoggingNext && nextSlotLabel ? nextSlotLabel : getTimeSlot();
      await logWearPlan.mutateAsync({
        date: new Date().toISOString().slice(0, 10),
        timeSlot: timeSlotToSave,
        slots,
        name: outfitToLog.items.map((i) => i.name).join(' + '),
      });

      if (userId) {
        queryClient.invalidateQueries({
          queryKey: ['frequent-combos', userId],
        });
        queryClient.invalidateQueries({
          queryKey: ['monthly-insights', userId],
        });
        queryClient.invalidateQueries({
          queryKey: ['dashboard-stats', userId],
        });
        queryClient.invalidateQueries({
          queryKey: ['sustainability-story', userId],
        });
        queryClient.invalidateQueries({ queryKey: ['outfit-suggest', userId] });
        queryClient.invalidateQueries({ queryKey: ['outfit-plans', userId] });
        queryClient.invalidateQueries({ queryKey: ['outfit-dna', userId] });
      }

      setLoggedOutfit(outfitToLog);
      setLoggedSlot(timeSlotToSave as 'day' | 'night');
      setShowingLogged(true);
      setNextOutfit(null);
      setShowLogConfirm(false);
      toast.success('Outfit logged!');
    } catch {
      toast.error('Failed to log outfit');
    } finally {
      setLoggingWear(false);
      loggingRef.current = false;
    }
  }, [
    outfit,
    nextOutfit,
    showingLogged,
    nextSlotLabel,
    session?.user?.id,
    queryClient,
    logWearPlan,
  ]);

  const handleGetNextSlotSuggestion = useCallback(async () => {
    if (!nextSlotLabel || loadingNext) return;
    setLoadingNext(true);
    try {
      const nextOccasion = nextSlotLabel === 'night' ? 'formal' : 'casual';
      const res = await fetch('/api/outfits/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occasion: nextOccasion,
          weather: weatherData?.current
            ? {
                temperature: weatherData.current.temperature,
                weathercode: weatherData.current.weathercode,
              }
            : null,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setNextOutfit(data.suggestions?.[0] || null);
      setShowingLogged(false);
    } catch {
      // silent
    } finally {
      setLoadingNext(false);
    }
  }, [nextSlotLabel, loadingNext, weatherData?.current]);

  const handleBackToLogged = useCallback(() => {
    setShowingLogged(true);
  }, []);

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

  // Show onboarding only when insights fully loaded and indicates insufficient data
  if (insights && insights.insufficient_data) {
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

  const health = insights?.wardrobe_health;
  const overallHealth = health
    ? Math.round(
        (health.category_balance_score + health.color_diversity_score) / 2,
      )
    : 0;

  const displayOutfit = showingLogged ? loggedOutfit : nextOutfit || outfit;
  const outfitName =
    displayOutfit?.items.map((i) => i.name).join(' + ') || null;
  const outfitDescription = displayOutfit?.ai_reasoning || null;
  const outfitItems = displayOutfit?.items || [];
  const outfitTags = displayOutfit?.items.map((i) => i.type) || [];

  const topWornItem =
    insights?.most_worn && insights.most_worn.length > 0
      ? insights.most_worn[0]
      : null;

  const pledges = pledgesData?.pledges || [];
  const fallbackPartnerText = pledgesData?.fallback_partner_text || 'Partner';
  const acceptedPledges = pledges.filter((p) => p.status === 'accepted');
  const pendingPledges = pledges.filter((p) => p.status === 'pending');
  const topPledge = acceptedPledges[0] || pendingPledges[0] || null;

  const userName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 md:px-8 lg:px-12 py-8 max-w-[1280px] mx-auto space-y-12">
        {/* Greeting + Streak */}
        <section className="flex justify-between items-start gap-8 md:gap-16">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl md:text-5xl font-bold text-on-surface font-headline tracking-tight">
              {insights?.greeting ||
                `Good ${getTimeSlot() === 'day' ? 'Day' : 'Evening'}`}
              , {userName}.
            </h1>
            {insights?.month_theme && (
              <p className="text-sm text-on-surface-variant mt-1 font-body">
                {insights.month_theme}
              </p>
            )}
            {insights?.headline && (
              <p className="text-lg text-on-surface-variant mt-2 font-body">
                {insights.headline}
              </p>
            )}
            {insights?.summary && (
              <p className="text-base text-on-surface-variant mt-2 font-body">
                {insights.summary}
              </p>
            )}
            <div className="flex flex-wrap gap-4 mt-3">
              {insights?.fun_fact && (
                <span className="text-sm text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">
                    lightbulb
                  </span>
                  {insights.fun_fact}
                </span>
              )}
              {insights?.items_in_wardrobe_text && (
                <span className="text-sm text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">
                    checkroom
                  </span>
                  {insights.items_in_wardrobe_text}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 pt-4 lg:pt-6 pr-2 lg:pr-16">
            <StreakCard currentStreak={insights?.wear_streak ?? 0} />
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
                description={
                  outfitDescription ||
                  insights?.empty_outfit_text ||
                  'No outfit suggestion available'
                }
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
                onLogWear={
                  showingLogged ? undefined : () => setShowLogConfirm(true)
                }
                loggingWear={loggingWear}
                isLogged={showingLogged && loggedOutfit !== null}
                loggedSlot={loggedSlot}
                nextSlotLabel={nextSlotLabel}
                canGoBack={loggedOutfit !== null && !showingLogged}
                onGetNext={handleGetNextSlotSuggestion}
                onBackToLogged={handleBackToLogged}
                loadingNext={loadingNext}
              />
            ) : (
              <div className="glass-card rounded-lg p-6 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2">
                  checkroom
                </span>
                <p className="text-sm mb-3">
                  {insights?.empty_outfit_text || 'Loading suggestions...'}
                </p>
                <Link
                  href={insights?.empty_outfit_cta || '/wardrobe/upload'}
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
            {topWornItem && health && (
              <MonthlyStory
                itemName={topWornItem.name}
                itemImage={topWornItem.image_url}
                wearCount={topWornItem.times_worn_this_month}
                totalWears={topWornItem.total_wears}
                costPerWear={
                  topWornItem.price && topWornItem.total_wears > 0
                    ? Math.round((topWornItem.price / topWornItem.total_wears) * 100) / 100
                    : health.cost_per_wear
                }
                utilizationText={
                  topWornItem.price && topWornItem.total_wears > 0
                    ? `Cost per wear: $${Math.round((topWornItem.price / topWornItem.total_wears) * 100) / 100}`
                    : health.cost_per_wear > 0
                      ? `Wardrobe avg: $${health.cost_per_wear.toFixed(2)}/wear`
                      : undefined
                }
              />
            )}

            {/* Smart Shopping List */}
            {insights?.shopping_list && insights.shopping_list.length > 0 && (
              <SmartShoppingList items={insights.shopping_list} />
            )}
          </div>
        </div>

        {/* Wardrobe Wellness */}
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {insights?.seasonal_tip ? (
              <SeasonalReadiness
                coveragePct={insights.seasonal_tip.coverage_pct}
                missingTypes={insights.seasonal_tip.missing_types}
                tip={insights.seasonal_tip.tip}
                coverageDetail={insights.seasonal_tip.coverage_detail}
                missingTooltips={insights.seasonal_tip.missing_tooltips}
                transitionTip={insights.seasonal_tip.transition_tip}
              />
            ) : (
              <div className="bg-surface-container-low rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-surface-variant rounded w-1/3 mb-4" />
                <div className="h-16 bg-surface-variant rounded-xl mb-3" />
              </div>
            )}
            {health ? (
              <CircularityScore
                score={overallHealth}
                totalItems={health.total_items}
                itemsWornThisMonth={health.items_worn_this_month}
                scoreBreakdown={health.score_breakdown}
              />
            ) : (
              <div className="bg-surface-container-low rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-surface-variant rounded w-1/3 mb-4" />
                <div className="h-16 bg-surface-variant rounded-xl mb-3" />
              </div>
            )}
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
        {insights ? (
          <WardrobeAnalytics
            colors={insights.color_palette}
            categories={insights.category_balance}
            topWorn={insights.most_worn}
          />
        ) : (
          <div className="bg-surface-container-low rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-surface-variant rounded w-1/4 mb-4" />
            <div className="h-40 bg-surface-variant rounded-xl" />
          </div>
        )}
      </div>

      <ConfirmModal
        open={showLogConfirm}
        title="Log this outfit?"
        message={`Record ${outfitName || 'this outfit'} for ${(() => {
          const isLoggingNext = !showingLogged && nextOutfit !== null;
          const ts =
            isLoggingNext && nextSlotLabel ? nextSlotLabel : currentSlot;
          return ts === 'day' ? 'today' : 'tonight';
        })()}.`}
        confirmLabel="Log Wear"
        confirmVariant="primary"
        onConfirm={handleLogWear}
        onCancel={() => setShowLogConfirm(false)}
        loading={loggingWear}
      />
    </div>
  );
}
