'use client';

import Image from 'next/image';

interface Props {
  month?: string;
  itemName: string;
  itemImage?: string | null;
  wearCount: number;
  totalWears?: number;
  costPerWear?: number;
  utilizationText?: string;
  title?: string;
}

export default function MonthlyStory({
  month,
  itemName,
  itemImage,
  wearCount,
  totalWears,
  costPerWear,
  utilizationText,
  title = 'Most Worn',
}: Props) {
  const displayMonth =
    month || new Date().toLocaleString('default', { month: 'long' });

  const derivedUtilizationText = (() => {
    if (
      costPerWear != null &&
      costPerWear > 0 &&
      totalWears != null &&
      totalWears > 0
    ) {
      const isLow = costPerWear < 5;
      return isLow
        ? 'High utilization - Low Cost Per Wear'
        : `Cost per wear: $${costPerWear.toFixed(2)}`;
    }
    if (totalWears != null && totalWears > 5) return 'Well-loved piece';
    if (wearCount > 0) return 'Active this month';
    return 'Could use more wear';
  })();

  const displayUtilizationText = utilizationText ?? derivedUtilizationText;

  return (
    <div className="glass-card rounded-lg p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-on-surface">{title}</span>
        <span className="text-xs text-on-surface-variant">{displayMonth}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded bg-surface-variant overflow-hidden shrink-0 flex items-center justify-center relative">
          {itemImage ? (
            <Image
              fill
              src={itemImage}
              alt={itemName}
              className="object-cover"
            />
          ) : (
            <span className="material-symbols-outlined text-on-surface-variant">
              checkroom
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-on-surface">{itemName}</p>
          <p className="text-xs text-on-surface-variant">
            {wearCount > 0 ? (
              <>
                Worn {wearCount} time{wearCount !== 1 ? 's' : ''} this month
                {totalWears != null && totalWears > wearCount
                  ? ` (${totalWears} total)`
                  : ''}
              </>
            ) : totalWears != null && totalWears > 0 ? (
              <>
                Worn {totalWears} time{totalWears !== 1 ? 's' : ''} total
              </>
            ) : (
              'Not worn yet'
            )}
          </p>
        </div>
      </div>
      <div className="mt-1 pt-3 border-t border-surface-variant flex items-center gap-1 text-primary">
        <span className="material-symbols-outlined text-sm">
          energy_savings_leaf
        </span>
        <span className="text-xs font-medium">{displayUtilizationText}</span>
      </div>
    </div>
  );
}
