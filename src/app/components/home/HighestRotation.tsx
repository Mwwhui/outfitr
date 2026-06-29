'use client';

interface WearItem {
  item_id: string;
  name: string;
  image_url: string | null;
  type: string;
  times_worn_this_month: number;
  total_wears: number;
}

interface Props {
  items: WearItem[];
  title?: string;
  wearLabel?: string;
}

export default function HighestRotation({ items, title = 'Highest Rotation', wearLabel = 'wears' }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-surface-bright p-6 rounded-lg border border-outline-variant flex flex-col items-center justify-center min-h-[200px]">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2">trending_up</span>
        <p className="text-sm text-on-surface-variant">No wear data yet</p>
      </div>
    );
  }

  const display = [...items]
    .sort((a, b) => {
      const aWears = a.times_worn_this_month || a.total_wears;
      const bWears = b.times_worn_this_month || b.total_wears;
      return bWears - aWears;
    })
    .slice(0, 3);

  return (
    <div className="bg-surface-bright p-6 rounded-lg border border-outline-variant">
      <h4 className="text-sm font-bold text-on-surface mb-4">{title}</h4>
      <ul className="space-y-3">
        {display.map((item, i) => {
          const wearCount = item.times_worn_this_month || item.total_wears;
          return (
            <li key={item.item_id || i} className="flex justify-between items-center border-b border-surface-variant pb-2 gap-2 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded overflow-hidden bg-surface-variant shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">checkroom</span>
                    </div>
                  )}
                </div>
                <span className="text-base text-on-surface">{item.name}</span>
              </div>
              <span className="text-xs bg-surface-container px-3 py-1 rounded text-on-surface-variant shrink-0">
                {wearCount} {wearLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
