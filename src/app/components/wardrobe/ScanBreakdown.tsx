'use client';

import type { ScanBreakdown as ScanBreakdownType } from '@/hooks/mutations/scanToBuy';

interface BreakdownBar {
  key: keyof ScanBreakdownType;
  label: string;
  color: string;
  invert?: boolean;
}

const BARS: BreakdownBar[] = [
  { key: 'gap_fill', label: 'Gap Fill', color: '#22c55e' },
  { key: 'color_fit', label: 'Color Fit', color: '#3b82f6' },
  { key: 'outfit_potential', label: 'Outfit Potential', color: '#a855f7' },
  { key: 'similarity_risk', label: 'Similarity Risk', color: '#ef4444' },
  { key: 'versatility', label: 'Versatility', color: '#14b8a6' },
];

interface ScanBreakdownProps {
  breakdown: ScanBreakdownType;
}

export default function ScanBreakdown({ breakdown }: ScanBreakdownProps) {
  return (
    <div className="space-y-3">
      {BARS.map((bar) => {
        const value = breakdown[bar.key];
        const displayValue = bar.invert ? 100 - value : value;

        return (
          <div key={bar.key}>
            <div className="flex justify-between text-xs text-on-surface-variant mb-1">
              <span className="font-semibold">{bar.label}</span>
              <span>{value}/100</span>
            </div>
            <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${displayValue}%`,
                  backgroundColor: bar.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
