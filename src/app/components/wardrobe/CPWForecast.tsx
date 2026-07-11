'use client';

import type { CostPerWear } from '@/hooks/mutations/scanToBuy';

interface CPWForecastProps {
  data: CostPerWear;
}

function getVerdictInfo(verdict: string): { label: string; color: string; icon: string } {
  switch (verdict) {
    case 'below_average':
      return { label: 'Better than average', color: '#22c55e', icon: 'check_circle' };
    case 'similar':
      return { label: 'Similar to average', color: '#f97316', icon: 'info' };
    case 'above_average':
      return { label: 'Higher than average', color: '#ef4444', icon: 'warning' };
    default:
      return { label: 'Unknown', color: '#9ca3af', icon: 'help' };
  }
}

export default function CPWForecast({ data }: CPWForecastProps) {
  const info = getVerdictInfo(data.verdict);
  const maxCpw = Math.max(data.projected_cpw, data.wardrobe_average_cpw, 1);
  const projectedPct = (data.projected_cpw / maxCpw) * 100;
  const avgPct = (data.wardrobe_average_cpw / maxCpw) * 100;

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-lg text-on-surface-variant">
          savings
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Cost Per Wear Forecast
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[10px] uppercase font-bold text-on-surface-variant">
            Est. Price
          </p>
          <p className="font-semibold text-on-surface">
            ${data.estimated_price}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-on-surface-variant">
            Projected Wears
          </p>
          <p className="font-semibold text-on-surface">
            {data.projected_wears}x
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-on-surface-variant">
            Projected CPW
          </p>
          <p className="font-semibold text-on-surface">
            ${data.projected_cpw}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-on-surface-variant">
            Your Avg CPW
          </p>
          <p className="font-semibold text-on-surface">
            ${data.wardrobe_average_cpw}
          </p>
        </div>
      </div>

      {/* Comparison bar */}
      <div className="mt-3 relative h-6">
        <div className="absolute inset-0 bg-surface-variant rounded-full" />
        <div
          className="absolute top-0 bottom-0 bg-on-surface-variant/30 rounded-full"
          style={{ right: `${100 - avgPct}%`, left: 0 }}
        />
        <div
          className="absolute top-0 bottom-0 rounded-full transition-all duration-700"
          style={{
            width: `${projectedPct}%`,
            backgroundColor: info.color,
            opacity: 0.7,
          }}
        />
        {/* Dots for markers */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
          style={{
            left: `${projectedPct}%`,
            backgroundColor: info.color,
          }}
        />
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <span
          className="material-symbols-outlined text-sm"
          style={{ color: info.color }}
        >
          {info.icon}
        </span>
        <span className="text-xs font-semibold" style={{ color: info.color }}>
          {info.label}
        </span>
      </div>
    </div>
  );
}
