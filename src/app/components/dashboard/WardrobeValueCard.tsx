'use client';

import { useState } from 'react';

interface WardrobeValue {
  total_value: number;
  average_value: number;
  items_with_price: number;
  items_without_price: number;
  total_wears: number;
  cost_per_wear: number;
  replacement_saved: number;
}

interface Props {
  data: WardrobeValue;
  totalItems: number;
}

const comparisons = [
  { label: 'new T-shirts', value: (v: number) => Math.round(v / 25) },
  { label: 'café visits', value: (v: number) => Math.round(v / 5) },
  { label: 'lunches out', value: (v: number) => Math.round(v / 15) },
  { label: 'days of groceries', value: (v: number) => Math.round(v / 20) },
];

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#0f172a] text-white text-xs leading-relaxed rounded-xl shadow-lg z-10 pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0f172a]" />
        </span>
      )}
    </span>
  );
}

export default function WardrobeValueCard({ data, totalItems }: Props) {
  const safe = (data || {
    total_value: 0,
    average_value: 0,
    items_with_price: 0,
    items_without_price: 0,
    total_wears: 0,
    cost_per_wear: 0,
    replacement_saved: 0,
  });

  const comparison = comparisons[Math.floor(Math.random() * comparisons.length)];
  const hasWears = safe.total_wears > 0;

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 lg:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-[#163422]">Wardrobe Value</span>
        {safe.items_without_price > 0 && (
          <span className="text-[10px] text-gray-400 ml-auto bg-gray-50 px-2 py-1 rounded-full">
            {safe.items_with_price > 0 ? 'Estimated from your prices' : 'Estimated'}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-bold text-[#0f172a]">
          ${safe.total_value.toLocaleString()}
        </span>
      </div>

      {hasWears ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-2xl p-3.5 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </span>
              <div>
                <div className="text-lg font-bold text-[#0f172a]">
                  {safe.total_wears.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">total wears
                  <Tooltip text="Number of times your wardrobe items have been worn in the last 3 months, tracked through outfit plans logged in the Planner.">
                    <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center cursor-help text-[8px] font-bold leading-none">?</span>
                  </Tooltip>
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3.5 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <div>
                <div className="text-lg font-bold text-[#0f172a]">
                  ${safe.cost_per_wear.toFixed(2)}
                  <span className="text-xs font-normal text-gray-400 ml-1">/wear</span>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">cost per wear
                  <Tooltip text="Total wardrobe value divided by total wears. The lower this number, the more value you're getting from your clothes.">
                    <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center cursor-help text-[8px] font-bold leading-none">?</span>
                  </Tooltip>
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3.5 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </span>
              <div>
                <div className="text-lg font-bold text-[#0f172a]">
                  ${safe.replacement_saved.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">saved vs buying new
                  <Tooltip text="Total wears multiplied by the average item price. Estimates how much you would have spent if you bought a new outfit each time instead of wearing what you own.">
                    <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center cursor-help text-[8px] font-bold leading-none">?</span>
                  </Tooltip>
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            The more you wear what you own, the cheaper each wear gets.{' '}
            At ${safe.cost_per_wear.toFixed(2)} per wear, every outfit from your wardrobe
            puts money back in your pocket.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500 leading-relaxed mb-3">
            Your {totalItems} items are worth{' '}
            <span className="font-semibold text-[#0f172a]">${safe.total_value.toLocaleString()}</span>
            {' '}— enough for{' '}
            <span className="font-semibold text-[#0f172a]">{comparison.value(safe.total_value)}</span>{' '}
            {comparison.label}.
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-lg">📋</span>
            <p className="text-sm text-gray-500">
              Log your outfits in the{' '}
              <a href="/planner" className="font-semibold text-[#0f172a] underline underline-offset-2">
                Planner
              </a>{' '}
              to see your cost per wear — the more you wear, the more value you unlock.
            </p>
          </div>
        </>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 mt-3 border-t border-gray-100">
        <span>~${safe.average_value} avg per item</span>
        {safe.items_with_price > 0 && safe.items_without_price > 0 && (
          <span>
            {safe.items_without_price} items estimated from your average
          </span>
        )}
      </div>
    </div>
  );
}
