'use client';

import { useQuery, queryOptions } from '@tanstack/react-query';

export interface FrequentComboItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
  season: string | null;
  brand: string | null;
}

export interface FrequentCombo {
  key: string;
  frequency: number;
  last_worn: string;
  days_since_worn: number;
  name: string | null;
  items: FrequentComboItem[];
}

export interface FrequentResponse {
  combos: FrequentCombo[];
  total_outfits: number;
  unique_combos: number;
}

export const frequentCombosOptions = (userId?: string, limit = 10) =>
  queryOptions({
    queryKey: ['frequent-combos', userId, limit],
    queryFn: async (): Promise<FrequentResponse> => {
      const res = await fetch(`/api/outfits/frequent?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch frequent combos');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useFrequentCombos(userId?: string, limit = 10) {
  return useQuery(frequentCombosOptions(userId, limit));
}

export interface OutfitDNA {
  formula: string;
  color_habits: string[];
  strong_pairs: Array<{ item_a: string; item_b: string; count: number }>;
  never_tried: Array<{
    item_a: string;
    item_b: string;
    reason: string;
    item_a_id?: string | null;
    item_b_id?: string | null;
  }>;
  pattern_breakers: Array<{
    combo: string[];
    combo_items: Array<{ id: string; name: string; type: string; color: string | null; image_url: string | null }>;
    reason: string;
  }>;
  style_summary: string;
}

export const outfitDnaOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['outfit-dna', userId],
    queryFn: async (): Promise<OutfitDNA> => {
      const res = await fetch('/api/outfits/dna', { method: 'POST', body: '{}' });
      if (!res.ok) throw new Error('Failed to fetch outfit DNA');
      return res.json();
    },
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useOutfitDNA(userId?: string) {
  return useQuery(outfitDnaOptions(userId));
}

export interface SuggestionItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
}

export interface OutfitSuggestion {
  items: SuggestionItem[];
  score: number;
  ai_reasoning: string;
  style: string;
  color_harmony: number;
}

export interface SuggestionsResponse {
  suggestions: OutfitSuggestion[];
  message?: string;
}

export interface SuggestWeather {
  temperature: number;
  description: string;
  icon: string;
  weathercode: number;
}

export const outfitSuggestionsOptions = (userId?: string, weather?: SuggestWeather | null) =>
  queryOptions({
    queryKey: ['outfit-suggestions', userId, weather],
    queryFn: async (): Promise<SuggestionsResponse> => {
      const res = await fetch('/api/outfits/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weather }),
      });
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!userId && !!weather,
    placeholderData: (previous) => previous,
  });

export function useOutfitSuggestions(userId?: string, weather?: SuggestWeather | null) {
  return useQuery(outfitSuggestionsOptions(userId, weather));
}
