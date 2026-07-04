'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface CreatePledgeData {
  partnerId: string;
  itemIds: string[];
  actionType: string;
}

export function useCreatePledge(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePledgeData) => {
      const res = await fetch('/api/pledges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit pledge');
      }
      return res.json();
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['pledges', userId] });
      queryClient.invalidateQueries({ queryKey: ['clothes', userId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', userId] });
      queryClient.invalidateQueries({ queryKey: ['monthly-insights', userId] });
      queryClient.invalidateQueries({ queryKey: ['sustainability-story', userId] });
    },
  });
}

export interface UpdatePledgeData {
  id: string;
  action: 'accept' | 'reject' | 'fulfill';
  token?: string;
  rejection_reason?: string;
}

export function useUpdatePledgeStatus(userId?: string, status?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdatePledgeData) => {
      const { id, ...body } = data;
      const res = await fetch(`/api/partner/pledges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${data.action} pledge`);
      }
      return res.json();
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['partner-pledges', userId] });
      if (status) {
        queryClient.invalidateQueries({ queryKey: ['partner-pledges', userId, status] });
      }
    },
  });
}
