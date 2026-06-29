'use client';

interface CategoryItem {
  type: string;
  count: number;
  ideal: number;
  pct: number;
}

interface Props {
  categories: CategoryItem[];
  title?: string;
  summaryText?: string;
}

const PIE_COLORS = [
  '#163422',
  '#2d6a4f',
  '#52b788',
  '#95d5b2',
  '#d8f3dc',
  '#40916c',
  '#74c69d',
  '#b7e4c7',
];

export default function CategoryBalance({ categories, title = 'Category Balance', summaryText }: Props) {
  if (categories.length === 0) {
    return (
      <div className="bg-surface-bright p-6 rounded-lg border border-outline-variant flex flex-col items-center justify-center min-h-[200px]">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2">donut_large</span>
        <p className="text-sm text-on-surface-variant">No category data yet</p>
      </div>
    );
  }

  const totalCount = categories.reduce((s, c) => s + c.count, 0);
  const displaySummary = summaryText ?? `${totalCount} total items across ${categories.length} categories`;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let cumulativePct = 0;

  return (
    <div className="bg-surface-bright p-6 rounded-lg border border-outline-variant flex flex-col">
      <h4 className="text-sm font-bold text-on-surface mb-4">{title}</h4>
      <div className="flex-1 flex items-center justify-center gap-6">
        <svg width="150" height="150" viewBox="0 0 150 150">
          {categories.slice(0, 8).map((cat, i) => {
            const pct = cat.pct;
            const dashLength = (pct / 100) * circumference;
            const dashOffset = -(cumulativePct / 100) * circumference;
            cumulativePct += pct;
            return (
              <circle
                key={i}
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke={PIE_COLORS[i % PIE_COLORS.length]}
                strokeWidth="28"
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                className="transition-all duration-500"
              />
            );
          })}
          <text x="75" y="70" textAnchor="middle" className="fill-on-surface text-2xl font-bold">{totalCount}</text>
          <text x="75" y="88" textAnchor="middle" className="fill-on-surface-variant text-[10px]">items</text>
        </svg>
        <div className="flex flex-col gap-1.5">
          {categories.slice(0, 8).map((cat, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="text-xs text-on-surface-variant truncate max-w-[90px]">{cat.type}</span>
              <span className="text-xs text-on-surface font-medium">{cat.count}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-on-surface-variant mt-4 text-center">
        {displaySummary}
      </p>
    </div>
  );
}
