'use client';

import Link from 'next/link';
import AlertBell from './AlertBell';

interface MobileTopBarProps {
  onMenuOpen: () => void;
}

export default function MobileTopBar({ onMenuOpen }: MobileTopBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md border-b border-outline-variant z-40 flex items-center justify-between px-4 md:hidden">
      <button
        onClick={onMenuOpen}
        className="p-2 -ml-2 text-on-surface hover:bg-surface-container rounded-xl transition"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-2xl">menu</span>
      </button>

      <Link
        href="/home"
        className="font-dancingscript font-extrabold text-xl text-black"
      >
        Outfitr
      </Link>

      <AlertBell variant="mobile" />
    </div>
  );
}
