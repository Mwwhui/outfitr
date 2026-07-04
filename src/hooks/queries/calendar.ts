'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

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

export function useCalendarEvents() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return useQuery({
    queryKey: ['calendar', today],
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
    placeholderData: (previous) => previous,
  });
}
