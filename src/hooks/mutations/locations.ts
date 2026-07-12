'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LocationZone } from '@/hooks/queries/locations';

export function useTogglePinZone(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const res = await fetch(`/api/locations/zones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) throw new Error('Failed to toggle pin');
    },

    onMutate: async ({ id, pinned }) => {
      await queryClient.cancelQueries({ queryKey: ['location-zones', userId] });
      const previous = queryClient.getQueryData<LocationZone[]>(['location-zones', userId]);
      queryClient.setQueryData<LocationZone[]>(['location-zones', userId], (old) =>
        old?.map((z) => (z.id === id ? { ...z, pinned } : z)),
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['location-zones', userId], context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['location-zones', userId] });
      queryClient.invalidateQueries({ queryKey: ['closet-layout', userId] });
    },
  });
}
