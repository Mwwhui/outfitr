'use client';

import { useQuery, queryOptions } from '@tanstack/react-query';

export interface InsightsData {
  insufficient_data?: boolean;
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

export interface OutfitSuggestion {
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

export interface PledgeData {
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
  fulfilled_at: string | null;
  rejection_reason: string | null;
}

interface PledgesResponse {
  pledges: PledgeData[];
  fallback_partner_text: string;
}

export interface SustainabilityData {
  story: string;
  impact: {
    co2_saved_kg: number;
    water_saved_l: number;
    equivalent_trees: number;
    items_diverted: number;
    money_saved: number;
  };
  sustainability_rate: number;
}

export const monthlyInsightsOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['monthly-insights', userId],
    queryFn: async (): Promise<InsightsData> => {
      const res = await fetch('/api/wardrobe/monthly-insights');
      if (!res.ok) throw new Error('Failed to load insights');
      return res.json();
    },
    staleTime: 15 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useMonthlyInsights(userId?: string) {
  return useQuery(monthlyInsightsOptions(userId));
}

export const outfitSuggestOptions = (
  occasion: string,
  weather: { temperature?: number; weathercode?: number } | null,
  userId?: string,
) =>
  queryOptions({
    queryKey: ['outfit-suggest', userId, occasion, weather?.temperature ?? 'no-weather'],
    queryFn: async (): Promise<OutfitSuggestion | null> => {
      const res = await fetch('/api/outfits/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occasion,
          weather: weather
            ? { temperature: weather.temperature, weathercode: weather.weathercode }
            : null,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.suggestions?.[0] || null;
    },
    staleTime: 30 * 60 * 1000,
    enabled: !!userId && !!occasion,
    retry: 1,
    placeholderData: (previous) => previous,
  });

export function useOutfitSuggestion(
  occasion: string,
  weather: { temperature?: number; weathercode?: number } | null,
  userId?: string,
) {
  return useQuery(outfitSuggestOptions(occasion, weather, userId));
}

export const pledgesOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['pledges', userId],
    queryFn: async (): Promise<PledgesResponse> => {
      const res = await fetch('/api/pledges');
      if (!res.ok) return { pledges: [], fallback_partner_text: 'Partner' };
      return res.json();
    },
    staleTime: 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function usePledges(userId?: string) {
  return useQuery(pledgesOptions(userId));
}

export const sustainabilityStoryOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['sustainability-story', userId],
    queryFn: async (): Promise<SustainabilityData | null> => {
      const res = await fetch('/api/wardrobe/sustainability-story');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useSustainabilityStory(userId?: string) {
  return useQuery(sustainabilityStoryOptions(userId));
}

export const alertsOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['alerts', userId],
    queryFn: async (): Promise<{ preloved: number; activity: number }> => {
      const res = await fetch('/api/home/alerts');
      if (!res.ok) return { preloved: 0, activity: 0 };
      const data = await res.json();
      return {
        preloved: (data.pledges_pending || 0) + (data.pledges_accepted || 0),
        activity: data.pledges_total || 0,
      };
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useAlerts(userId?: string) {
  return useQuery(alertsOptions(userId));
}
