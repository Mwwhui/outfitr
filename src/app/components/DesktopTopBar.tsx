'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AlertBell from './AlertBell';

export default function DesktopTopBar() {
  const router = useRouter();
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'User';

  return (
    <div className="hidden lg:flex items-center justify-end gap-3 px-4 py-2">
      <AlertBell variant="sidebar" />

      <button
        onClick={() => router.push('/profile/edit')}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high transition"
        aria-label="Profile"
      >
        <div className="relative shrink-0">
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name || 'User'}
              width={32}
              height={32}
              className="rounded-full object-cover border border-outline-variant"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">
              {session?.user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 border-2 border-white" />
        </div>
        <span className="text-sm font-medium text-on-surface">{firstName}</span>
      </button>
    </div>
  );
}
