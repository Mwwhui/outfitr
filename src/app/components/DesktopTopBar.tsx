'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AlertBell from './AlertBell';

export default function DesktopTopBar() {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <div className="hidden lg:flex items-center justify-end gap-2 px-4 py-2">
      <AlertBell variant="sidebar" />

      <button
        onClick={() => router.push('/profile/edit')}
        className="relative shrink-0 p-1 rounded-full hover:bg-surface-container transition"
        aria-label="Profile"
      >
        {session?.user?.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || 'User'}
            className="w-8 h-8 rounded-full object-cover border border-outline-variant"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">
            {session?.user?.name?.charAt(0) || 'U'}
          </div>
        )}
        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 border-2 border-white" />
      </button>
    </div>
  );
}
