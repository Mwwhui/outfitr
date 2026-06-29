'use client';

import { useState } from 'react';

interface ScoreBreakdown {
  score: number;
  detail: string;
  suggestion: string;
}

interface Props {
  score: number;
  totalItems: number;
  itemsWornThisMonth: number;
  label?: string;
  badge?: string;
  title?: string;
  utilizationText?: string;
  scoreUnit?: string;
  scoreBreakdown?: {
    category_balance: ScoreBreakdown;
    color_diversity: ScoreBreakdown;
  };
}

export default function CircularityScore({
  score,
  totalItems,
  itemsWornThisMonth,
  label,
  badge,
  title = 'Circularity Score',
  utilizationText,
  scoreUnit = '/100',
  scoreBreakdown,
}: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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

        {scoreBreakdown && (
          <div className="mt-4 space-y-2">
            <button
              onClick={() => setExpandedSection(expandedSection === 'category' ? null : 'category')}
              className="w-full flex items-center justify-between p-2 bg-surface-container-low rounded border border-surface-variant hover:bg-surface-variant transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">category</span>
                <span className="text-xs font-medium text-on-surface">Category Balance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface">{scoreBreakdown.category_balance.score}/100</span>
                <span className="material-symbols-outlined text-xs text-on-surface-variant">
                  {expandedSection === 'category' ? 'expand_less' : 'expand_more'}
                </span>
              </div>
            </button>
            {expandedSection === 'category' && (
              <div className="p-3 bg-surface-container-low rounded border border-surface-variant ml-5">
                <p className="text-xs text-on-surface mb-1">{scoreBreakdown.category_balance.detail}</p>
                <p className="text-xs text-primary font-medium">{scoreBreakdown.category_balance.suggestion}</p>
              </div>
            )}

            <button
              onClick={() => setExpandedSection(expandedSection === 'color' ? null : 'color')}
              className="w-full flex items-center justify-between p-2 bg-surface-container-low rounded border border-surface-variant hover:bg-surface-variant transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">palette</span>
                <span className="text-xs font-medium text-on-surface">Color Diversity</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface">{scoreBreakdown.color_diversity.score}/100</span>
                <span className="material-symbols-outlined text-xs text-on-surface-variant">
                  {expandedSection === 'color' ? 'expand_less' : 'expand_more'}
                </span>
              </div>
            </button>
            {expandedSection === 'color' && (
              <div className="p-3 bg-surface-container-low rounded border border-surface-variant ml-5">
                <p className="text-xs text-on-surface mb-1">{scoreBreakdown.color_diversity.detail}</p>
                <p className="text-xs text-primary font-medium">{scoreBreakdown.color_diversity.suggestion}</p>
              </div>
            )}
          </div>
        )}
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
