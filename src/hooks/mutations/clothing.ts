'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClothingItem, ItemDetail } from '@/hooks/queries/wardrobe';

export interface CreateClothingData {
  user_id: string;
  name: string;
  type: string;
  color: string;
  season: string | null;
  size: string | null;
  brand: string | null;
  price: number | null;
  material: string | null;
  favorite: boolean;
  image_url: string;
  use_case: string[];
  description: string | null;
  purchase_date: string | null;
  location: string | null;
  notes: string | null;
}

export function useCreateClothing(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateClothingData): Promise<ItemDetail> => {
      const res = await fetch('/api/clothes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save clothing');
      }
      return res.json();
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['clothes', userId] });
      queryClient.invalidateQueries({ queryKey: ['clusters', userId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', userId] });
      queryClient.invalidateQueries({ queryKey: ['monthly-insights', userId] });
      queryClient.invalidateQueries({ queryKey: ['sustainability-story', userId] });
      queryClient.invalidateQueries({ queryKey: ['frequent-combos', userId] });
      queryClient.invalidateQueries({ queryKey: ['outfit-dna', userId] });
      queryClient.invalidateQueries({ queryKey: ['brands', userId] });
      queryClient.invalidateQueries({ queryKey: ['materials', userId] });
      queryClient.invalidateQueries({ queryKey: ['locations', userId] });
      queryClient.invalidateQueries({ queryKey: ['similar', userId] });
    },
  });
}

export interface UpdateClothingData {
  id: string;
  name: string;
  type: string;
  color: string;
  season: string | null;
  size: string | null;
  brand: string | null;
  price: number | null;
  material: string | null;
  favorite: boolean;
  image_url: string | null;
  use_case: string[];
  categories: string[] | null;
  description: string | null;
  purchase_date: string | null;
  location: string | null;
  notes: string | null;
}

export function useUpdateClothing(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateClothingData) => {
      const { id, ...body } = data;
      const res = await fetch(`/api/clothes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update item');
      }
      return res.json();
    },
    onMutate: async (data) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: ['item', userId, data.id] });
      await queryClient.cancelQueries({ queryKey: ['clothes', userId] });

      const previousItem = queryClient.getQueryData<ItemDetail>(['item', userId, data.id]);
      const previousClothes = queryClient.getQueryData<ClothingItem[]>(['clothes', userId]);

      queryClient.setQueryData<ItemDetail>(['item', userId, data.id], (old) => {
        if (!old) return old;
        return { ...old, ...data };
      });

      queryClient.setQueryData<ClothingItem[]>(['clothes', userId], (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === data.id ? { ...c, ...data } as ClothingItem : c));
      });

      return { previousItem, previousClothes };
    },
    onError: (_err, _vars, context) => {
      if (!userId || !context) return;
      queryClient.setQueryData(['item', userId, _vars.id], context.previousItem);
      queryClient.setQueryData(['clothes', userId], context.previousClothes);
    },
    onSuccess: (_data, variables) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['item', userId, variables.id] });
      queryClient.invalidateQueries({ queryKey: ['clothes', userId] });
      queryClient.invalidateQueries({ queryKey: ['clusters', userId] });
      queryClient.invalidateQueries({ queryKey: ['similar', userId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', userId] });
      queryClient.invalidateQueries({ queryKey: ['monthly-insights', userId] });
      queryClient.invalidateQueries({ queryKey: ['sustainability-story', userId] });
    },
  });
}

export function useDeleteClothing(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clothes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onMutate: async (id) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: ['clothes', userId] });

      const previousClothes = queryClient.getQueryData<ClothingItem[]>(['clothes', userId]);

      queryClient.setQueryData<ClothingItem[]>(['clothes', userId], (old) => {
        if (!old) return old;
        return old.filter((c) => c.id !== id);
      });

      return { previousClothes };
    },
    onError: (_err, _vars, context) => {
      if (!userId || !context?.previousClothes) return;
      queryClient.setQueryData(['clothes', userId], context.previousClothes);
    },
    onSuccess: (_data, id) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['item', userId, id] });
      queryClient.invalidateQueries({ queryKey: ['clothes', userId] });
      queryClient.invalidateQueries({ queryKey: ['clusters', userId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', userId] });
      queryClient.invalidateQueries({ queryKey: ['monthly-insights', userId] });
      queryClient.invalidateQueries({ queryKey: ['sustainability-story', userId] });
      queryClient.invalidateQueries({ queryKey: ['frequent-combos', userId] });
      queryClient.invalidateQueries({ queryKey: ['outfit-dna', userId] });
      queryClient.invalidateQueries({ queryKey: ['similar', userId] });
    },
  });
}

export function useToggleFavorite(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, favorite }: { id: string; favorite: boolean }) => {
      const res = await fetch(`/api/clothes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite }),
      });
      if (!res.ok) throw new Error('Failed to update favorite');
    },
    onMutate: async ({ id, favorite }) => {
      await queryClient.cancelQueries({ queryKey: ['clothes', userId] });
      await queryClient.cancelQueries({ queryKey: ['item', userId, id] });
      const previous = queryClient.getQueryData<ClothingItem[]>(['clothes', userId]);
      queryClient.setQueryData<ClothingItem[]>(['clothes', userId], (old) =>
        old?.map((c) => (c.id === id ? { ...c, favorite } : c)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['clothes', userId], context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clothes', userId] });
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['item', userId, variables.id] });
      }
    },
  });
}

export function useBatchUpdateStatus(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string | null }) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/clothes/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }),
        ),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0 && succeeded === 0) throw new Error('All items failed');
      return { succeeded, failed };
    },
    onMutate: async ({ ids, status }) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: ['clothes', userId] });
      const previous = queryClient.getQueryData<ClothingItem[]>(['clothes', userId]);
      queryClient.setQueryData<ClothingItem[]>(['clothes', userId], (old) => {
        if (!old) return old;
        return old.map((c) => (ids.includes(c.id) ? { ...c, status } : c));
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['clothes', userId], context.previous);
      }
    },
    onSettled: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['clothes', userId] });
      queryClient.invalidateQueries({ queryKey: ['clusters', userId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', userId] });
      queryClient.invalidateQueries({ queryKey: ['monthly-insights', userId] });
      queryClient.invalidateQueries({ queryKey: ['sustainability-story', userId] });
    },
  });
}
