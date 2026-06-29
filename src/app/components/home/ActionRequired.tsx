'use client';

interface Props {
  itemCount: number;
  partnerName: string;
  progressPct: number;
  scheduledDate: string;
  label?: string;
}

export default function ActionRequired({
  itemCount,
  partnerName,
  progressPct,
  scheduledDate,
  label = 'Action Pending',
}: Props) {
  return (
    <div className="bg-surface-bright rounded-lg p-6 border border-outline-variant shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-primary">local_shipping</span>
        <span className="text-sm font-bold text-on-surface">{label}</span>
      </div>
      <p className="text-base text-on-surface-variant mb-4">
        {itemCount} item{itemCount !== 1 ? 's' : ''} pending at {partnerName}.
      </p>
      <div
        className="w-full bg-surface-variant rounded-full h-2 mb-1"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} progress`}
      >
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="text-xs text-on-surface-variant text-right">{scheduledDate}</p>
    </div>
  );
}
