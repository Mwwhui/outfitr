import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function HangerIcon(props: IconProps) {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}>
      <path d="M11 2v3" />
      <path d="M3 13l8 3 8-3" />
      <path d="M3 13a2 2 0 1 0 0-3" />
      <path d="M19 13a2 2 0 1 0 0-3" />
    </svg>
  );
}

export function RobeIcon(props: IconProps) {
  return (
    <svg width="22" height="24" viewBox="0 0 22 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6c0-2 3-4 7-4s7 2 7 4" />
      <path d="M4 6l-2 7 3 1 2-2" />
      <path d="M18 6l2 7-3 1-2-2" />
      <path d="M5 12l-1 8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1l-1-8" />
      <path d="M11 21v-8" />
    </svg>
  );
}

export function ShelfIcon(props: IconProps) {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}>
      <path d="M1 3h20" />
      <path d="M3 9h16" />
      <path d="M1 15h18" />
      <path d="M1 17V1" />
    </svg>
  );
}

export function DrawerIcon(props: IconProps) {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}>
      <rect x="1" y="1" width="20" height="16" rx="2" />
      <line x1="1" y1="9" x2="21" y2="9" />
      <circle cx="17" cy="6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function OtherIcon(props: IconProps) {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}>
      <rect x="1" y="1" width="20" height="16" rx="2" />
      <circle cx="7" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WardrobeIcon(props: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="1" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <circle cx="9" cy="5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="5" r="0.8" fill="currentColor" stroke="none" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="6" y1="18" x2="9" y2="18" />
      <line x1="15" y1="18" x2="18" y2="18" />
    </svg>
  );
}

export function getZoneIcon(type: string) {
  switch (type) {
    case 'hanging':
      return HangerIcon;
    case 'drawer':
      return DrawerIcon;
    case 'shelf':
      return ShelfIcon;
    default:
      return OtherIcon;
  }
}