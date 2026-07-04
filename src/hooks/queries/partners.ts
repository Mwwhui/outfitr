'use client';

import { useQuery, queryOptions } from '@tanstack/react-query';

export interface Partner {
  id: string;
  name: string;
  description: string;
  type: 'donate' | 'sell' | 'recycle';
  address: string;
  lat: number;
  lng: number;
  distance?: string;
  rawDistance?: number;
}

export const partnersOptions = () =>
  queryOptions({
    queryKey: ['partners'],
    queryFn: async (): Promise<Partner[]> => {
      const res = await fetch('/api/partners');
      if (!res.ok) throw new Error('Failed to fetch partners');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: (previous) => previous,
  });

export function usePartners() {
  return useQuery(partnersOptions());
}
