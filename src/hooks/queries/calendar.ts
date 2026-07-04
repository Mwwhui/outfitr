'use client';

import { useMemo } from 'react';
import { useQuery, queryOptions } from '@tanstack/react-query';
import type { ClothingItem } from './wardrobe';

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

export interface CalendarResult {
  events: CalendarEvent[];
  connected: boolean;
  needsReconnect: boolean;
}

export interface OutfitPlanRow {
  id?: string;
  date: string;
  time_slot: string;
  slots: Record<string, ClothingItem | null>;
  name?: string | null;
}

export const outfitPlansOptions = (userId?: string, from?: string, to?: string) =>
  queryOptions({
    queryKey: ['outfit-plans', userId, from, to],
    queryFn: async (): Promise<OutfitPlanRow[]> => {
      const res = await fetch(`/api/outfit_plans?from=${from}&to=${to}`);
      if (!res.ok) {
        console.error('Failed to load outfit plans:', await res.text());
        return [];
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
    retry: 1,
    enabled: !!userId && !!from && !!to,
    placeholderData: (previous) => previous,
  });

export function useOutfitPlans(userId?: string, from?: string, to?: string) {
  return useQuery(outfitPlansOptions(userId, from, to));
}

export function useGoogleStatus(userId?: string, enabled = true) {
  return useQuery({
    queryKey: ['google-status', userId],
    queryFn: async (): Promise<boolean> => {
      try {
        const res = await fetch('/api/integrations/google/status');
        if (!res.ok) return false;
        const data = await res.json();
        return Boolean(data.connected);
      } catch {
        return false;
      }
    },
    staleTime: 60 * 1000,
    retry: 1,
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useCalendarEvents(userId?: string) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return useQuery({
    queryKey: ['calendar', userId, today],
    queryFn: async (): Promise<CalendarResult> => {
      try {
        const statusRes = await fetch('/api/integrations/google/status');
        const status = await statusRes.json();

        if (!status.connected) {
          return { events: [], connected: false, needsReconnect: false };
        }

        const eventsRes = await fetch(
          `/api/integrations/google/events?date=${today}`,
        );
        if (eventsRes.status === 401) {
          return { events: [], connected: true, needsReconnect: true };
        }
        if (!eventsRes.ok) {
          return { events: [], connected: true, needsReconnect: false };
        }
        const eventsData = await eventsRes.json();
        return {
          events: eventsData.events || [],
          connected: true,
          needsReconnect: false,
        };
      } catch {
        return { events: [], connected: false, needsReconnect: false };
      }
    },
    staleTime: 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });
}
