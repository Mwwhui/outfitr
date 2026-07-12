'use client';

import { useQuery, queryOptions } from '@tanstack/react-query';

export interface Category {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

export type ClothingItem = {
  id: string;
  name: string;
  type: string;
  color: string;
  season: string;
  image_url: string | null;
  favorite?: boolean;
  wear_count?: number;
  use_case?: string[];
  brand: string | null;
  material: string | null;
  status?: string | null;
  location?: string | null;
  zone_id?: string | null;
  sort_order?: number | null;
};

export interface DuplicateGroup {
  type: string;
  color: string;
  items: { id: string; name: string; type: string; image_url: string | null; wear_count: number; price: number; status?: string | null }[];
}

export interface ClusterGroup {
  id: number;
  label: string;
  color: string;
  size: number;
  items: { id: string; name: string; type: string; image_url: string | null; wear_count: number; price: number; status?: string | null }[];
  groups?: DuplicateGroup[];
  insight?: {
    totalValue: number;
    avgWear: number;
    avgPrice: number;
    wearVsAverage: number;
    typeBreakdown: { type: string; count: number; percentage: number }[];
  };
}

interface ClustersResponse {
  clusters: ClusterGroup[];
}

export const clothesOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['clothes', userId],
    queryFn: async (): Promise<ClothingItem[]> => {
      const res = await fetch(`/api/clothes?user_id=${userId}`);
      if (!res.ok) throw new Error('Failed to load clothes');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useClothes(userId?: string) {
  return useQuery(clothesOptions(userId));
}

export const categoriesOptions = () =>
  queryOptions({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    staleTime: Infinity,
    retry: 1,
    placeholderData: (previous) => previous,
  });

export function useCategories() {
  return useQuery(categoriesOptions());
}

export const clustersOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['clusters', userId],
    queryFn: async (): Promise<ClustersResponse> => {
      const res = await fetch('/api/wardrobe/clusters');
      if (!res.ok) throw new Error('Failed to fetch clusters');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useClusters(userId?: string) {
  return useQuery(clustersOptions(userId));
}

export interface ItemDetail {
  id: string;
  user_id: string;
  name: string;
  type: string;
  color: string;
  season: string | null;
  size: string | null;
  brand: string | null;
  price: number | null;
  material: string | null;
  favorite: boolean | null;
  image_url: string | null;
  categories: string[] | null;
  description: string | null;
  purchase_date: string | null;
  location: string | null;
  zone_id: string | null;
  sort_order: number | null;
  notes: string | null;
  use_case: string[] | null;
  created_at?: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export const itemOptions = (id?: string, userId?: string) =>
  queryOptions({
    queryKey: ['item', userId, id],
    queryFn: async (): Promise<ItemDetail> => {
      const res = await fetch(`/api/clothes/${id}`);
      if (!res.ok) throw new Error('Failed to fetch item');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!id && !!userId,
    placeholderData: (previous) => previous,
  });

export function useItem(id?: string, userId?: string) {
  return useQuery(itemOptions(id, userId));
}

export interface SimilarItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
  similarity: number;
}

interface SimilarResponse {
  similar: SimilarItem[];
  count: number;
}

export const similarItemsOptions = (type?: string, color?: string, excludeId?: string, userId?: string) =>
  queryOptions({
    queryKey: ['similar', userId, type, color, excludeId],
    queryFn: async (): Promise<SimilarItem[]> => {
      const params = new URLSearchParams({ type: type!, user_id: userId! });
      if (color) params.set('color', color);
      if (excludeId) params.set('exclude_id', excludeId);
      const res = await fetch(`/api/clothes/similar?${params}`);
      if (!res.ok) throw new Error('Failed to fetch similar items');
      const data: SimilarResponse = await res.json();
      return data.similar || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!type && !!excludeId && !!userId,
    placeholderData: (previous) => previous,
  });

export function useSimilarItems(type?: string, color?: string, excludeId?: string, userId?: string) {
  return useQuery(similarItemsOptions(type, color, excludeId, userId));
}

type SuggestionEndpoint = 'brands' | 'materials' | 'locations';

export const suggestionsOptions = (endpoint: SuggestionEndpoint, userId?: string) =>
  queryOptions({
    queryKey: [endpoint, userId],
    queryFn: async (): Promise<string[]> => {
      const res = await fetch(`/api/${endpoint}?user_id=${userId}`);
      if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
      const data = await res.json();
      return data[endpoint] || [];
    },
    staleTime: Infinity,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useSuggestions(endpoint: SuggestionEndpoint, userId?: string) {
  return useQuery(suggestionsOptions(endpoint, userId));
}
