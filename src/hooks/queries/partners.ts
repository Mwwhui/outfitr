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

export interface PartnerPledgeUser {
  id: string;
  email: string;
  name: string;
}

export interface PartnerPledgeItem {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
}

export interface PartnerPledge {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'fulfilled';
  action_type: string;
  rejection_reason: string | null;
  qr_token: string | null;
  created_at: string;
  fulfilled_at?: string | null;
  user: PartnerPledgeUser | null;
  items: PartnerPledgeItem[];
}

export const partnerPledgesOptions = (userId?: string, status?: string) =>
  queryOptions({
    queryKey: ['partner-pledges', userId, status],
    queryFn: async (): Promise<PartnerPledge[]> => {
      const params = status ? `?status=${status}` : '';
      const res = await fetch(`/api/partner/pledges${params}`);
      if (!res.ok) throw new Error('Failed to fetch partner pledges');
      return res.json();
    },
    staleTime: 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function usePartnerPledges(userId?: string, status?: string) {
  return useQuery(partnerPledgesOptions(userId, status));
}
