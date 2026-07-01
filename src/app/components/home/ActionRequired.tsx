'use client';

import Link from 'next/link';

interface PledgeItem {
  id: string;
  name: string;
  image_url: string | null;
}

interface Props {
  partnerName: string;
  status: string;
  label?: string;
  actionType?: string;
  items?: PledgeItem[];
  createdAt?: string;
}

const ACTION_ICONS: Record<string, string> = {
  donate: 'volunteer_activism',
  sell: 'payments',
  recycle: 'recycling',
};

const ACTION_COLORS: Record<string, string> = {
  donate: 'text-green-600',
  sell: 'text-amber-600',
  recycle: 'text-blue-600',
};

const STEPS = ['pending', 'accepted', 'fulfilled'] as const;

const STATUS_NEXT: Record<string, string> = {
  pending: 'Waiting for partner to accept',
  accepted: 'Ready for drop-off — check your email for QR code',
  fulfilled: 'Completed — items have been delivered',
  rejected: 'This pledge was declined by the partner',
};

function getStepIndex(status: string): number {
  if (status === 'fulfilled') return 2;
  if (status === 'accepted') return 1;
  if (status === 'rejected') return -1;
  return 0;
}

function formatDaysSince(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function ActionRequired({
  partnerName,
  status,
  label = 'Action Pending',
  actionType = 'donate',
  items = [],
  createdAt,
}: Props) {
  const icon = ACTION_ICONS[actionType] || 'local_shipping';
  const colorClass = ACTION_COLORS[actionType] || 'text-primary';
  const currentStep = getStepIndex(status);
  const nextText = STATUS_NEXT[status] || STATUS_NEXT.pending;

  return (
    <div className="bg-surface-bright rounded-lg p-5 border border-outline-variant shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <span className={`material-symbols-outlined text-lg ${colorClass}`}>{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-on-surface block truncate">{label}</span>
          <span className="text-xs text-on-surface-variant">at {partnerName}</span>
        </div>
        {createdAt && (
          <span className="text-xs text-on-surface-variant shrink-0">{formatDaysSince(createdAt)}</span>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex -space-x-1">
            {items.slice(0, 3).map((item) => (
              <div key={item.id} className="w-7 h-7 rounded-full bg-surface-variant border-2 border-white overflow-hidden shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-xs text-on-surface-variant flex items-center justify-center h-full">checkroom</span>
                )}
              </div>
            ))}
          </div>
          <span className="text-xs text-on-surface-variant truncate">
            {items.slice(0, 2).map((i) => i.name).join(', ')}
            {items.length > 2 && ` +${items.length - 2}`}
          </span>
        </div>
      )}

      {/* Status Timeline */}
      <div className="flex items-center mb-3">
        {STEPS.map((step, i) => {
          const isActive = i <= currentStep && currentStep >= 0;
          const isCurrent = i === currentStep && currentStep >= 0;
          return (
            <div key={step} className="flex-1 flex justify-center items-center relative">
              {i > 0 && (
                <div className={`absolute right-1/2 left-0 top-1/2 -translate-y-1/2 h-0.5 ${
                  i - 1 < currentStep && currentStep >= 0 ? 'bg-primary' : 'bg-surface-variant'
                }`} />
              )}
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 relative z-10 ${
                isCurrent ? 'bg-primary scale-125' :
                isActive ? 'bg-primary' :
                'bg-surface-variant'
              }`} />
              {i < STEPS.length - 1 && (
                <div className={`absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-0.5 ${
                  i < currentStep && currentStep >= 0 ? 'bg-primary' : 'bg-surface-variant'
                }`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex mb-3">
        {STEPS.map((step, i) => (
          <span key={step} className={`flex-1 text-[10px] capitalize text-center ${
            i === currentStep && currentStep >= 0 ? 'text-primary font-semibold' : 'text-on-surface-variant'
          }`}>
            {step}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
        {nextText}
      </div>

      <Link
        href="/activity"
        className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline py-1"
      >
        View on Activities
        <span className="material-symbols-outlined text-xs">open_in_new</span>
      </Link>
    </div>
  );
}
