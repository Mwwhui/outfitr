'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Loader from '../../components/Loader';

export default function AuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated') {
      if (session?.user?.role === 'partner') {
        router.push('/partner/dashboard');
      } else {
        router.push('/home');
      }
    }
  }, [session, status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader message="Redirecting..." />
    </div>
  );
}
