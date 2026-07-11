'use client';

import { useState } from 'react';

interface MissingTooltip {
  type: string;
  suggestion: string;
  reason: string;
  searchQuery?: string;
}

interface Props {
  coveragePct: number;
  missingTypes: string[];
  title?: string;
  readyLabel?: string;
  missingLabel?: string;
  tip?: string;
  coverageDetail?: string;
  missingTooltips?: MissingTooltip[];
  transitionTip?: string;
}

export default function SeasonalReadiness({
  coveragePct,
  missingTypes,
  title = 'Seasonal Readiness',
  readyLabel = 'Ready',
  missingLabel = 'Missing Essentials:',
  tip,
  coverageDetail,
  missingTooltips = [],
  transitionTip,
}: Props) {
  const [expandedTooltip, setExpandedTooltip] = useState<string | null>(null);

  return (
    <div className="bg-surface-bright rounded-lg p-6 border border-outline-variant shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">wb_sunny</span>
          <span className="text-sm font-bold text-on-surface">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-primary font-bold">{coveragePct}% {readyLabel}</span>
          {coverageDetail && (
            <div className="relative group">
              <span className="material-symbols-outlined text-xs text-on-surface-variant cursor-help">info</span>
              <div className="absolute right-0 top-6 z-10 w-64 p-3 bg-[#0f172a] text-white text-xs leading-relaxed rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {coverageDetail}
                <span className="absolute top-full right-4 border-4 border-transparent border-t-[#0f172a]" />
              </div>
            </div>
          )}
        </div>
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

      {tip && (
        <p className="text-xs text-on-surface-variant mb-4 italic">{tip}</p>
      )}

      {missingTypes.length > 0 && (
        <div className="space-y-1 mb-4">
          <p className="text-xs text-on-surface-variant mb-1">{missingLabel}</p>
          {missingTypes.map((type, i) => {
            const tooltip = missingTooltips.find((t) => t.type === type);
            const isExpanded = expandedTooltip === type;
            return (
              <div key={i}>
                <button
                  onClick={() => setExpandedTooltip(isExpanded ? null : type)}
                  className="flex items-center gap-1 text-base w-full text-left hover:bg-surface-container-low rounded px-1 py-0.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">add_circle</span>
                  <span className="flex-1 break-words">{type}</span>
                  {tooltip && (
                    <span className="material-symbols-outlined text-xs text-on-surface-variant shrink-0">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  )}
                </button>
                {isExpanded && tooltip && (
                  <div className="ml-6 mt-1 mb-2 p-3 bg-surface-container-low rounded-lg border border-surface-variant break-words">
                    <p className="text-xs font-medium text-on-surface mb-1 break-words">{tooltip.reason}</p>
                    <p className="text-xs text-on-surface-variant mb-2 break-words">{tooltip.suggestion}</p>
                    {tooltip.searchQuery && (
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(tooltip.searchQuery)}&tbm=shop`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-1"
                      >
                        <span className="material-symbols-outlined text-xs">shopping_cart</span>
                        Find {type.toLowerCase()} online
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {transitionTip && (
        <div className="flex items-start gap-2 pt-3 border-t border-surface-variant">
          <span className="material-symbols-outlined text-sm text-primary shrink-0">swap_horiz</span>
          <p className="text-xs text-on-surface-variant">{transitionTip}</p>
        </div>
      )}
    </div>
  );
}
