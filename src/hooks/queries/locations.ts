'use client';

import { useQuery, queryOptions } from '@tanstack/react-query';

export interface LocationZone {
  id: string;
  user_id: string;
  name: string;
  type: 'shelf' | 'drawer' | 'hanging' | 'other';
  display_order: number;
  color: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string | null;
}

export const locationZonesOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['location-zones', userId],
    queryFn: async (): Promise<LocationZone[]> => {
      const res = await fetch('/api/locations/zones');
      if (!res.ok) throw new Error('Failed to load zones');
      const data = await res.json();
      return data.zones || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useLocationZones(userId?: string) {
  return useQuery(locationZonesOptions(userId));
}

export interface ClosetLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  static?: boolean;
}

export const closetLayoutOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['closet-layout', userId],
    queryFn: async (): Promise<ClosetLayoutItem[]> => {
      const res = await fetch('/api/closet-layout');
      if (!res.ok) throw new Error('Failed to load closet layout');
      const data = await res.json();
      return data.layout || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useClosetLayout(userId?: string) {
  return useQuery(closetLayoutOptions(userId));
}
