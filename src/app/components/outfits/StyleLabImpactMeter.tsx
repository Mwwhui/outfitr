'use client';

interface StyleLabImpactMeterProps {
  reactivatedCount: number;
  totalSuggestedItems: number;
  weeklyChange: number;
}

export default function StyleLabImpactMeter({
  reactivatedCount,
  totalSuggestedItems,
  weeklyChange,
}: StyleLabImpactMeterProps) {
  const score = totalSuggestedItems > 0
    ? Math.round((reactivatedCount / totalSuggestedItems) * 100)
    : 0;

  return (
    <div className="bg-primary text-on-primary p-6 rounded-xl relative overflow-hidden">
      <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
        <span className="material-symbols-outlined text-[120px]">park</span>
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
          <span className="text-sm uppercase tracking-wider font-semibold">Impact Meter</span>
        </div>
        <p className="text-sm text-on-primary/70 mb-6">Reuse underutilized items</p>

        <div className="flex items-end justify-between mb-4">
          <div className="text-3xl font-black text-on-primary">
            {reactivatedCount}<span className="text-on-primary/50 text-xl font-bold">/{totalSuggestedItems}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
              {weeklyChange >= 0 ? '+' : ''}{weeklyChange}% THIS WEEK
            </span>
          </div>
        </div>

        <div className="w-full bg-white/20 h-2 rounded-full mb-4">
          <div
            className="bg-white h-2 rounded-full transition-all duration-500"
            style={{ width: `${score}%` }}
          />
        </div>

        <p className="text-sm text-on-primary/70 leading-relaxed">
          By rotating the &ldquo;unexplored combos&rdquo; as suggested by the AI, you&rsquo;ve reactivated{' '}
          <span className="font-semibold text-on-primary">{reactivatedCount}</span> of{' '}
          <span className="font-semibold text-on-primary">{totalSuggestedItems}</span> garments
          that were previously stagnant.
        </p>
      </div>
    </div>
  );
}
