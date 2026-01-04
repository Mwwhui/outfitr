'use client';

import { SessionProvider } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Header from './components/Header';
import Footer from './components/Footer';
import Toaster from './components/Toaster';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideHeader =
    pathname === '/auth/login' || pathname === '/auth/register';

  return (
    <SessionProvider>
      <div className="flex flex-col min-h-screen">
        {!hideHeader && <Header />}

        <main className="flex-grow">{children}</main>

        {!hideHeader && <Footer />}
        <Toaster />
      </div>
    </SessionProvider>
  );
}
