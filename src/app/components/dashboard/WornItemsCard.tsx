'use client';

interface WornItem {
  id: string;
  name: string;
  type: string;
  wear_count: number;
  image_url?: string | null;
}

interface WornItemsCardProps {
  mostWorn: WornItem[];
  leastWorn: WornItem[];
}

const TYPE_ICONS: Record<string, string> = {
  Tops: '👕',
  Bottoms: '👖',
  Outerwear: '🧥',
  'One-Piece': '👗',
};

function WornList({
  items,
  label,
  highlight,
}: {
  items: WornItem[];
  label: string;
  highlight: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-6">
        No items yet
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50"
        >
          {item.image_url ? (
            <div
              className="w-9 h-9 rounded-lg bg-cover bg-center shrink-0"
              style={{ backgroundImage: `url(${item.image_url})` }}
            />
          ) : (
            <span className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 text-sm">
              {TYPE_ICONS[item.type] || '👕'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#0f172a] truncate">
              {item.name}
            </p>
            <p className="text-xs text-gray-400">{item.type}</p>
          </div>
          <span
            className={`text-sm font-bold shrink-0 ${
              highlight ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            {item.wear_count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function WornItemsCard({
  mostWorn = [],
  leastWorn = [],
}: WornItemsCardProps) {
  const hasData = mostWorn.length > 0 || leastWorn.length > 0;

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 lg:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-[#163422]">
          Most & Least Worn
        </span>
      </div>

      {hasData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span className="text-emerald-500">●</span> Most worn
            </p>
            <WornList items={mostWorn} label="most" highlight />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span className="text-gray-300">●</span> Least worn
            </p>
            <WornList items={leastWorn} label="least" highlight={false} />
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-500">
            📋 Start logging outfits in the{' '}
            <a
              href="/planner"
              className="font-semibold text-[#0f172a] underline underline-offset-2"
            >
              Planner
            </a>{' '}
            to see which items you wear most and which ones need some love.
          </p>
        </div>
      )}
    </div>
  );
}
