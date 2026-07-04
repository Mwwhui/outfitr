'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface CreateOutfitPlanData {
  date: string;
  timeSlot: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slots: Record<string, any>;
  name?: string;
}

export function useCreateOutfitPlan(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateOutfitPlanData) => {
      const res = await fetch('/api/outfit_plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save outfit');
      return res.json();
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['outfit-plans', userId] });
    },
  });
}

export function useDeleteOutfitPlan(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/outfit_plans/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete outfit');
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['outfit-plans', userId] });
    },
  });
}
