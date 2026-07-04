'use client';

import { useQuery, queryOptions } from '@tanstack/react-query';

export interface DashboardData {
  totals: {
    items: number;
    items_this_month: number;
    pledges_total: number;
    pledges_pending: number;
    pledges_accepted: number;
    pledges_fulfilled: number;
    pledges_rejected: number;
    fulfilled_change_pct: number;
    sustainability_rate: number;
  };
  categories: { name: string; count: number; color: string }[];
  brands: { name: string; count: number; color: string }[];
  materials: { name: string; count: number; color: string }[];
  items_over_time: { month: string; count: number }[];
  pledges_over_time: { month: string; pending: number; accepted: number; fulfilled: number }[];
  status_breakdown: { status: string; count: number }[];
  action_types: { type: string; count: number }[];
  recent_activity: {
    pledge_id: string;
    partner_name: string;
    action_type: string;
    status: string;
    item_count: number;
    created_at: string;
  }[];
  impact: {
    co2_saved_kg: number;
    water_saved_l: number;
    items_diverted: number;
    equivalent_trees: number;
    money_saved: number;
    by_action: {
      donate: { count: number; co2_kg: number; water_l: number; money: number };
      sell: { count: number; co2_kg: number; water_l: number; money: number };
      recycle: { count: number; co2_kg: number; water_l: number; money: number };
    };
  };
  wardrobe: {
    total_value: number;
    average_value: number;
    items_with_price: number;
    items_without_price: number;
    total_wears: number;
    cost_per_wear: number;
    replacement_saved: number;
  };
  most_worn: { id: string; name: string; type: string; wear_count: number; image_url?: string | null }[];
  least_worn: { id: string; name: string; type: string; wear_count: number; image_url?: string | null }[];
  wears_over_time: { month: string; wears: number; items_worn: number }[];
  wearing_insight: string;
  this_month_wears: number;
  last_month_wears: number;
  wear_change_pct: number;
}

export const dashboardStatsOptions = (userId?: string) =>
  queryOptions({
    queryKey: ['dashboard-stats', userId],
    queryFn: async (): Promise<DashboardData> => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load' }));
        throw new Error(err.error || 'Failed to load dashboard');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!userId,
    placeholderData: (previous) => previous,
  });

export function useDashboardStats(userId?: string) {
  return useQuery(dashboardStatsOptions(userId));
}
