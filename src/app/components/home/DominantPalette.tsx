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

  const display = colors.slice(0, 5);
  const topColor = display[0];
  const totalItems = display.reduce((s, c) => s + c.count, 0);

  const displaySummary = summaryText ?? (() => {
    if (topColor.pct >= 40) {
      return `Your wardrobe leans heavily into ${topColor.color.toLowerCase()} (${topColor.pct}%)`;
    }
    if (topColor.pct >= 25 && display.length > 1) {
      return `${topColor.color} dominates at ${topColor.pct}%, with ${display[1].color.toLowerCase()} as a secondary`;
    }
    return `Well-balanced palette across ${display.length} colors`;
  })();

  return (
    <div className="bg-surface-bright p-6 rounded-lg border border-outline-variant flex flex-col">
      <h4 className="text-sm font-bold text-on-surface mb-4">{title}</h4>
      <div className="flex-1 flex flex-col gap-1.5">
        {display.map((item, i) => {
          const isDominant = i === 0;
          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 py-1.5 px-2 rounded ${
                isDominant ? 'bg-surface-container-low' : ''
              }`}
            >
              <div
                className={`rounded-full border border-outline-variant shrink-0 ${
                  isDominant ? 'w-5 h-5' : 'w-4 h-4'
                }`}
                style={{ backgroundColor: item.hex || '#ccc' }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-surface-variant rounded-full h-2 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: item.hex || '#ccc',
                      }}
                    />
                  </div>
                  <span className={`text-xs shrink-0 ${isDominant ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>
                    {item.pct}%
                  </span>
                </div>
              </div>
              <span className={`text-xs shrink-0 w-16 text-right ${isDominant ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>
                {item.color}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-surface-variant">
        <p className="text-xs text-on-surface-variant text-center">{displaySummary}</p>
        <p className="text-xs text-on-surface-variant text-center mt-0.5">
          {totalItems} items · {display.length} colors
        </p>
      </div>
    </div>
  );
}
