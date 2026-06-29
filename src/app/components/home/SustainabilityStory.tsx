'use client';

interface ImpactData {
  co2_saved_kg: number;
  water_saved_l: number;
  equivalent_trees: number;
  items_diverted: number;
  money_saved: number;
}

interface Props {
  story: string;
  impact: ImpactData;
  sustainabilityRate: number;
}

export default function SustainabilityStory({ story, impact, sustainabilityRate }: Props) {
  const stats = [
    { icon: 'forest', value: impact.equivalent_trees, label: 'trees', show: impact.equivalent_trees > 0 },
    { icon: 'water_drop', value: impact.water_saved_l.toLocaleString(), label: 'liters', show: impact.water_saved_l > 0 },
    { icon: 'cloud_off', value: `${impact.co2_saved_kg}`, label: 'kg CO₂', show: impact.co2_saved_kg > 0 },
    { icon: 'savings', value: `$${impact.money_saved}`, label: 'saved', show: impact.money_saved > 0 },
  ].filter((s) => s.show);

  return (
    <div className="bg-surface-bright rounded-lg p-6 border border-outline-variant shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-primary">eco</span>
          <span className="text-sm font-bold text-on-surface">Your Impact</span>
          <div className="relative group">
            <span className="material-symbols-outlined text-xs text-on-surface-variant cursor-help">info</span>
            <div className="absolute left-0 top-6 z-10 w-64 p-3 bg-[#0f172a] text-white text-xs leading-relaxed rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Tracks the environmental impact of your donated, resold, and recycled clothing. Based on industry averages for CO₂, water, and waste savings.
              <span className="absolute top-full left-4 border-4 border-transparent border-t-[#0f172a]" />
            </div>
          </div>
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{story}</p>

        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 bg-surface-container-low rounded-lg p-2">
                <span className="material-symbols-outlined text-sm text-primary">{stat.icon}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-on-surface leading-tight">{stat.value}</span>
                  <span className="text-xs text-on-surface-variant leading-tight">{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-surface-variant">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-on-surface-variant">Items diverted from landfill</span>
          <span className="text-xs font-bold text-primary">{sustainabilityRate}%</span>
        </div>
        <div className="w-full bg-surface-variant rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(sustainabilityRate, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
