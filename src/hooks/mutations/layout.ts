'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClosetLayoutItem } from '@/hooks/queries/locations';

export function useSaveClosetLayout(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (layout: ClosetLayoutItem[]) => {
      const res = await fetch('/api/closet-layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      });
      if (!res.ok) throw new Error('Failed to save closet layout');
      return res.json();
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['closet-layout', userId] });
      }
    },
  });
}