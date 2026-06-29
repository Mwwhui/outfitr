'use client';

interface ShoppingItem {
  item_type: string;
  color: string;
  search_query: string;
  priority: 'high' | 'medium' | 'low';
}

interface Props {
  items: ShoppingItem[];
  title?: string;
}

export default function SmartShoppingList({ items = [], title = 'Seasonal Gaps' }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="bg-surface-bright rounded-lg p-6 border border-outline-variant shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary">auto_awesome</span>
        <span className="text-sm font-bold text-on-surface">{title}</span>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between items-center p-3 bg-surface-container-low rounded border border-surface-variant">
            <span className="text-base">{item.color} {item.item_type}</span>
            <span className="material-symbols-outlined text-on-surface-variant">shopping_cart</span>
          </div>
        ))}
      </div>
    </div>
  );
}
