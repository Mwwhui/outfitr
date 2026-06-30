'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface NavItem {
  icon: string;
  label: string;
  href: string;
  badge?: number;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const USER_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { icon: 'home', label: 'Home', href: '/home' },
      { icon: 'checkroom', label: 'Wardrobe', href: '/wardrobe' },
      { icon: 'today', label: 'Planner', href: '/planner' },
      { icon: 'calendar_month', label: 'Calendar', href: '/calendar' },
    ],
  },
  {
    title: 'Discover',
    items: [
      { icon: 'style', label: 'Style Lab', href: '/outfits' },
      { icon: 'favorite', label: 'Pre-loved', href: '/pre-loved', badge: 0 },
      { icon: 'history', label: 'Activity', href: '/activity', badge: 0 },
    ],
  },
  {
    title: 'Insights',
    items: [
      { icon: 'dashboard', label: 'Dashboard', href: '/dashboard' },
    ],
  },
];

const PARTNER_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { icon: 'home', label: 'Home', href: '/home' },
      { icon: 'receipt_long', label: 'Requests', href: '/partner/dashboard' },
      { icon: 'qr_code_scanner', label: 'Scan QR', href: '/partner/scan' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { icon: 'dashboard', label: 'Dashboard', href: '/dashboard' },
    ],
  },
];

function usePledgeBadges() {
  const [prelovedCount, setPrelovedCount] = useState(0);
  const [activityCount, setActivityCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/pledges');
      if (!res.ok) return;
      const data = await res.json();
      const pledges = data.pledges || [];
      const active = pledges.filter(
        (p: { status: string }) => p.status === 'pending' || p.status === 'accepted'
      ).length;
      setPrelovedCount(active);
      setActivityCount(pledges.length);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchCounts();

    // Refetch every 60s
    const interval = setInterval(fetchCounts, 60000);

    // Refetch when user returns to tab
    const handleFocus = () => fetchCounts();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchCounts();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchCounts]);

  return { prelovedCount, activityCount };
}

function NavPill({
  item,
  isActive,
  onClick,
  index,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  index: number;
  collapsed: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25, ease: 'easeOut' }}
      className={`relative w-full flex items-center gap-0 lg:gap-3 px-0 lg:px-3 py-2.5 rounded-xl transition-all duration-200 group ${
        isActive
          ? 'bg-gradient-to-br from-[#0f172a] to-[#163422] text-white shadow-lg'
          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
      } justify-center ${collapsed ? '' : 'lg:justify-start'}`}
    >
      <span className="relative z-10 material-symbols-outlined text-lg">{item.icon}</span>
      {!collapsed && (
        <span className="relative z-10 text-sm font-medium flex-1 text-left hidden lg:block">
          {item.label}
        </span>
      )}
      {!collapsed && item.badge ? (
        <span className="relative z-10 hidden lg:flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
          <span className="text-xs font-semibold">{item.badge}</span>
        </span>
      ) : null}
      {item.badge ? (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error animate-pulse lg:hidden" />
      ) : null}
    </motion.button>
  );
}

export default function Sidebar({ mobile, onNavigate, collapsed = false, onToggleCollapse }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const isPartner = session?.user?.role === 'partner';
  const { prelovedCount, activityCount } = usePledgeBadges();

  const sections = isPartner ? PARTNER_SECTIONS : USER_SECTIONS;

  // Inject badge counts
  const enrichedSections = sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.href === '/pre-loved') return { ...item, badge: prelovedCount };
      if (item.href === '/activity') return { ...item, badge: activityCount };
      return item;
    }),
  }));

  const handleNavigate = (href: string) => {
    router.push(href);
    onNavigate?.();
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/login');
    onNavigate?.();
  };

  const quickAction = isPartner
    ? { label: 'Scan QR', href: '/partner/scan', icon: 'qr_code_scanner' }
    : { label: 'Add Item', href: '/wardrobe/upload', icon: 'add' };

  return (
    <div
      className={`h-full flex flex-col transition-all duration-300 ease-in-out ${
        mobile
          ? 'px-4 pb-6'
          : `bg-white/80 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl py-5 ${
              collapsed ? 'w-20 px-2' : 'w-[280px] px-2 lg:px-4'
            }`
      }`}
    >
      {/* Logo */}
      <div className="mb-6 px-1 flex items-center justify-between">
        <Link
          href="/home"
          onClick={() => onNavigate?.()}
          className="font-dancingscript font-extrabold text-2xl text-black hover:opacity-80 transition"
        >
          {collapsed ? 'O' : <span className="hidden lg:inline">Outfitr</span>}
          <span className="lg:hidden text-xl">O</span>
        </Link>
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide space-y-5">
        {enrichedSections.map((section, si) => (
          <div key={section.title || si}>
            {!collapsed && section.title && (
              <p className="hidden lg:block px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item, ii) => (
                <NavPill
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href}
                  onClick={() => handleNavigate(item.href)}
                  index={si * 10 + ii}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Quick Action */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.25 }}
          className="px-0 lg:px-3 pt-2"
        >
          <button
            onClick={() => handleNavigate(quickAction.href)}
            className="w-full flex items-center justify-center gap-0 lg:gap-2 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
          >
            <span className="material-symbols-outlined text-sm">{quickAction.icon}</span>
            {!collapsed && <span className="hidden lg:inline">{quickAction.label}</span>}
          </button>
        </motion.div>
      </nav>

      {/* Collapse Toggle — desktop only */}
      {!mobile && (
        <div className="hidden lg:flex justify-center py-2">
          <button
            onClick={onToggleCollapse}
            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-xl transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-lg">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>
      )}

      {/* Sign Out */}
      {!mobile && (
        <div className="hidden lg:block px-2">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 py-2 text-sm font-medium text-error hover:bg-red-50 rounded-xl transition ${
              collapsed ? 'justify-center' : 'px-3'
            }`}
            title="Sign Out"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}

      {/* Copyright micro-text */}
      {!mobile && !collapsed && (
        <p className="hidden lg:block mt-3 px-3 text-[10px] text-on-surface-variant/40">
          © {new Date().getFullYear()} Outfitr
        </p>
      )}
    </div>
  );
}
