'use client';

interface ColorItem {
  color: string;
  hex: string | null;
  count: number;
  pct: number;
}

interface Props {
  colors: ColorItem[];
  title?: string;
  summaryText?: string;
}

export default function DominantPalette({ colors, title = 'Dominant Palette', summaryText }: Props) {
  if (colors.length === 0) {
    return (
      <div className="bg-surface-bright p-6 rounded-lg border border-outline-variant flex flex-col items-center justify-center min-h-[200px]">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2">palette</span>
        <p className="text-sm text-on-surface-variant">No color data yet</p>
      </div>
    );
  }

  const topColor = colors[0]?.color || 'your wardrobe';

  const displaySummary = summaryText ?? `Heavily weighted towards ${topColor.toLowerCase()}.`;

  return (
    <div className="bg-surface-bright p-6 rounded-lg border border-outline-variant flex flex-col">
      <h4 className="text-sm font-bold text-on-surface mb-4">{title}</h4>
      <div className="flex-1 flex flex-col justify-center gap-2">
        {colors.slice(0, 5).map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="h-8 rounded border border-outline-variant shrink-0"
              style={{ backgroundColor: item.hex || '#ccc', width: `${Math.max(item.pct, 15)}%` }}
            />
            <span className="text-xs text-on-surface-variant whitespace-nowrap">
              {item.color} ({item.pct}%)
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-on-surface-variant mt-4 text-center">
        {displaySummary}
      </p>
    </div>
  );
}
