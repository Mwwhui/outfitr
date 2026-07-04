'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface UpdateProfileData {
  username: string;
  first_name: string;
  last_name: string;
  dob: string;
  nationality: string;
  gender: string;
  contact_no: string;
}

export function useUpdateProfile(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to update profile');
      return body;
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
