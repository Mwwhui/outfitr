'use client';

interface ShoppingItem {
  item_type: string;
  color: string;
  search_query: string;
  priority: 'high' | 'medium' | 'low';
  reason?: string;
  ai_recommendation?: string;
  style_tip?: string;
  avoid?: string;
}

interface Props {
  items: ShoppingItem[];
  title?: string;
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-400',
};

export default function SmartShoppingList({ items = [], title = 'Seasonal Gaps' }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="bg-surface-bright rounded-lg p-6 border border-outline-variant shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary">auto_awesome</span>
        <span className="text-sm font-bold text-on-surface">{title}</span>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="p-3 bg-surface-container-low rounded border border-surface-variant"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[item.priority] || 'bg-gray-400'}`} />
                <span className="text-base font-medium text-on-surface">
                  {item.color} {item.item_type}
                </span>
              </div>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(item.search_query)}&tbm=shop`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                Find this
                <span className="material-symbols-outlined text-xs">open_in_new</span>
              </a>
            </div>

            {item.ai_recommendation ? (
              <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                {item.ai_recommendation}
              </p>
            ) : item.reason ? (
              <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                {item.reason}
              </p>
            ) : null}

            {item.style_tip && (
              <p className="text-xs text-on-surface-variant italic mt-1 flex items-start gap-1">
                <span className="material-symbols-outlined text-xs shrink-0 mt-0.5">lightbulb</span>
                {item.style_tip}
              </p>
            )}

            {item.avoid && (
              <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                <span className="material-symbols-outlined text-xs shrink-0 mt-0.5">warning</span>
                {item.avoid}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
