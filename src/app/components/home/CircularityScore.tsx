'use client';

interface Props {
  score: number;
  totalItems: number;
  itemsWornThisMonth: number;
  label?: string;
  badge?: string;
  title?: string;
  utilizationText?: string;
  scoreUnit?: string;
}

export default function CircularityScore({ score, totalItems, itemsWornThisMonth, label, badge, title = 'Circularity Score', utilizationText, scoreUnit = '/100' }: Props) {
  const derived = (() => {
    if (score >= 80) return { label: 'Your wardrobe is in the top tier for repair and reuse.', badge: 'Sustainability Leader' };
    if (score >= 60) return { label: 'Your wardrobe has good circularity practices.', badge: 'Eco Conscious' };
    if (score >= 40) return { label: 'There is room to improve your wardrobe circularity.', badge: 'Getting There' };
    return { label: 'Consider repairing or reusing items before buying new.', badge: 'Room to Grow' };
  })();

  const displayLabel = label ?? derived.label;
  const displayBadge = badge ?? derived.badge;

  const utilizationPct = totalItems > 0 ? Math.round((itemsWornThisMonth / totalItems) * 100) : 0;
  const displayUtilizationText = utilizationText ?? `${utilizationPct}% of your wardrobe worn this month (${itemsWornThisMonth}/${totalItems} items)`;

  return (
    <div className="bg-surface-bright rounded-lg p-6 border border-outline-variant shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-primary">recycling</span>
          <span className="text-sm font-bold text-on-surface">{title}</span>
        </div>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-5xl font-bold text-on-surface">{score}</span>
          <span className="text-on-surface-variant text-sm font-semibold">{scoreUnit}</span>
        </div>
        <p className="text-base text-on-surface-variant">{displayLabel}</p>
      </div>
      <div className="mt-4 pt-3 border-t border-surface-variant space-y-2">
        <div className="flex items-center gap-1 text-primary">
          <span className="material-symbols-outlined text-sm">verified</span>
          <span className="text-xs font-medium">{displayBadge}</span>
        </div>
        <p className="text-xs text-on-surface-variant">
          {displayUtilizationText}
        </p>
      </div>
    </div>
  );
}
