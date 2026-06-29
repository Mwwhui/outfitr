'use client';

interface Props {
  coveragePct: number;
  missingTypes: string[];
  title?: string;
  readyLabel?: string;
  missingLabel?: string;
}

export default function SeasonalReadiness({ coveragePct, missingTypes, title = 'Seasonal Readiness', readyLabel = 'Ready', missingLabel = 'Missing Essentials:' }: Props) {
  return (
    <div className="bg-surface-bright rounded-lg p-6 border border-outline-variant shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">wb_sunny</span>
          <span className="text-sm font-bold text-on-surface">{title}</span>
        </div>
        <span className="text-xs text-primary font-bold">{coveragePct}% {readyLabel}</span>
      </div>
      <div
        className="w-full bg-surface-variant rounded-full h-2 mb-4"
        role="progressbar"
        aria-valuenow={coveragePct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Seasonal readiness: ${coveragePct}%`}
      >
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${coveragePct}%` }} />
      </div>
      {missingTypes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-on-surface-variant mb-1">{missingLabel}</p>
          {missingTypes.map((type, i) => (
            <div key={i} className="flex items-center gap-1 text-base">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">add_circle</span>
              <span>{type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
