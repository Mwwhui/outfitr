'use client';

import { useState, useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import BottomSheet from './components/BottomSheet';
import MobileTopBar from './components/MobileTopBar';
import DesktopTopBar from './components/DesktopTopBar';
import Toaster from './components/Toaster';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Read collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setSidebarCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  // Auth pages: no sidebar, full-screen centered
  const hideSidebar =
    pathname === '/auth/login' || pathname === '/auth/register';

  if (hideSidebar) {
    return (
      <SessionProvider>
        <div className="min-h-screen">{children}</div>
        <Toaster />
      </SessionProvider>
    );
  }

  return (
    <SessionProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block flex-shrink-0 relative z-20">
          <div className="h-full p-3">
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleCollapse}
            />
          </div>
        </aside>

        {/* Tablet Sidebar (icon-only) */}
        <aside className="hidden md:block lg:hidden flex-shrink-0 w-20">
          <div className="h-full p-2">
            <Sidebar collapsed />
          </div>
        </aside>

        {/* Mobile Top Bar */}
        <MobileTopBar onMenuOpen={() => setIsSheetOpen(true)} />

        {/* Mobile Bottom Sheet */}
        <AnimatePresence>
          {isSheetOpen && (
            <BottomSheet
              isOpen={isSheetOpen}
              onClose={() => setIsSheetOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0">
          <DesktopTopBar />
          <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </SessionProvider>
  );
}
