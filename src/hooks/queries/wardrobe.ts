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
  image_url?: string;
  favorite?: boolean;
  wear_count?: number;
  use_case?: string[];
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
