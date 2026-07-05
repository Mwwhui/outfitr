'use client';

import { useState } from 'react';

interface ShoppingItem {
  item_type: string;
  specific_name: string;
  color: string;
  material: string;
  use_case: string;
  image_url: string | null;
  search_query: string;
  priority: 'high' | 'medium' | 'low';
  reason_category: 'seasonal_gap' | 'category_balance' | 'color_diversity';
}

const REASON_BADGES: Record<string, { label: string; icon: string; className: string }> = {
  seasonal_gap: { label: 'Seasonal Gap', icon: 'ac_unit', className: 'bg-red-100 text-red-700' },
  category_balance: { label: 'Balance', icon: 'pie_chart', className: 'bg-blue-100 text-blue-700' },
  color_diversity: { label: 'Color', icon: 'palette', className: 'bg-purple-100 text-purple-700' },
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-400',
};

interface Props {
  items: ShoppingItem[];
  title?: string;
}

function ItemImage({ src, alt }: { src: string | null; alt: string }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className="w-20 h-20 rounded-lg bg-surface-variant flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-2xl text-on-surface-variant">checkroom</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-20 h-20 rounded-lg object-cover shrink-0"
      onError={() => setError(true)}
    />
  );
}

function getPrimaryCategory(items: ShoppingItem[]): string | null {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item.reason_category) {
      counts[item.reason_category] = (counts[item.reason_category] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

export default function SmartShoppingList({ items = [], title = 'Recommended For You' }: Props) {
  if (items.length === 0) return null;

  const primaryCategory = getPrimaryCategory(items);

  return (
    <div className="bg-surface-bright rounded-lg p-6 border border-outline-variant shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary">auto_awesome</span>
        <span className="text-sm font-bold text-on-surface">{title}</span>
        {primaryCategory && (
          <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${REASON_BADGES[primaryCategory]?.className || ''}`}>
            <span className="material-symbols-outlined text-[10px] leading-none">{REASON_BADGES[primaryCategory]?.icon}</span>
            {' '}
            {REASON_BADGES[primaryCategory]?.label}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex gap-3 p-3 bg-surface-container-low rounded-lg border border-surface-variant"
          >
            <ItemImage src={item.image_url} alt={item.specific_name} />
            <div className="flex-1 flex flex-col">
              <div className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${PRIORITY_DOT[item.priority] || 'bg-gray-400'}`} />
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-on-surface">{item.specific_name}</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {item.material}{item.use_case ? ` · ${item.use_case}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-2">
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(item.search_query)}&tbm=shop`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Find this
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
