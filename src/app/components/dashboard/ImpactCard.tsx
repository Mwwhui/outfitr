'use client';

import { useState } from 'react';

interface ImpactByAction {
  donate: { count: number; co2_kg: number; water_l: number; money: number };
  sell: { count: number; co2_kg: number; water_l: number; money: number };
  recycle: { count: number; co2_kg: number; water_l: number; money: number };
}

interface ImpactData {
  co2_saved_kg: number;
  water_saved_l: number;
  items_diverted: number;
  equivalent_trees: number;
  money_saved: number;
  by_action: ImpactByAction;
}

interface ImpactCardProps {
  sustainabilityRate: number;
  totalItems: number;
  impact?: ImpactData;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return n.toLocaleString();
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}

function waterLabel(liters: number): string {
  if (liters >= 1000000) return (liters / 1000000).toFixed(1) + 'M';
  if (liters >= 1000) return (liters / 1000).toFixed(0) + 'k';
  return liters.toString();
}

function sustainGrade(rate: number): { letter: string; label: string; color: string } {
  if (rate >= 80) return { letter: 'A', label: 'Excellent', color: 'text-emerald-600' };
  if (rate >= 60) return { letter: 'B', label: 'Great', color: 'text-green-600' };
  if (rate >= 40) return { letter: 'C', label: 'Good', color: 'text-amber-600' };
  if (rate >= 20) return { letter: 'D', label: 'Fair', color: 'text-orange-600' };
  return { letter: 'F', label: 'Needs attention', color: 'text-red-500' };
}

const ACTION_META: Record<string, { label: string; icon: string }> = {
  donate: { label: 'Donation', icon: '🎁' },
  sell: { label: 'Resale', icon: '💰' },
  recycle: { label: 'Recycling', icon: '♻️' },
};

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

export default function ImpactCard({
  sustainabilityRate,
  totalItems,
  impact = {
    co2_saved_kg: 0,
    water_saved_l: 0,
    items_diverted: 0,
    equivalent_trees: 0,
    money_saved: 0,
    by_action: {
      donate: { count: 0, co2_kg: 0, water_l: 0, money: 0 },
      sell: { count: 0, co2_kg: 0, water_l: 0, money: 0 },
      recycle: { count: 0, co2_kg: 0, water_l: 0, money: 0 },
    },
  },
}: ImpactCardProps) {
  const grade = sustainGrade(sustainabilityRate);

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 lg:p-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-[#0f172a]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22v-9" />
            <path d="M12 13c-1.5-2-4-3.5-7-4 1 3 2.5 5.5 5 7" />
            <path d="M12 13c1.5-2 4-3.5 7-4-1 3-2.5 5.5-5 7" />
            <path d="M12 4v9" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-[#163422]">
          Environmental Impact
        </span>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-500 font-medium">
              Sustainability Rate
            </span>
            <Tooltip text="The share of your wardrobe that has been responsibly rehomed through donation, resale, or recycling. Calculated as: total fulfilled items ÷ total wardrobe items × 100.">
              <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center cursor-help text-[10px] font-bold leading-none">
                ?
              </span>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 ${grade.color}`}>
              {grade.letter} — {grade.label}
            </span>
            <span className="text-lg font-bold text-[#0f172a]">
              {sustainabilityRate}%
            </span>
          </div>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(sustainabilityRate, 100)}%`,
              backgroundColor:
                sustainabilityRate >= 70
                  ? '#059669'
                  : sustainabilityRate >= 40
                    ? '#d97706'
                    : '#6b7280',
            }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {impact.items_diverted} of {totalItems} items diverted from landfill
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3.5">
          <span className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </span>
          <div>
            <div className="text-lg font-bold text-[#0f172a]">
              {formatNumber(impact.co2_saved_kg)}
              <span className="text-xs font-normal text-gray-400 ml-1">kg</span>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">CO₂ emissions avoided
              <Tooltip text="Estimated CO₂ emissions prevented by diverting items from landfill. Based on industry averages: 3.5 kg per donated item, 2.5 kg per resold item, 1.5 kg per recycled item.">
                <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center cursor-help text-[8px] font-bold leading-none">?</span>
              </Tooltip>
            </p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3.5">
          <span className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </span>
          <div>
            <div className="text-lg font-bold text-[#0f172a]">
              {waterLabel(impact.water_saved_l)}
              <span className="text-xs font-normal text-gray-400 ml-1">L</span>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">Fresh water conserved
              <Tooltip text="Estimated fresh water conserved by avoiding the production of new clothing. Based on industry averages: 2,000 L per donated item, 1,500 L per resold item, 500 L per recycled item.">
                <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center cursor-help text-[8px] font-bold leading-none">?</span>
              </Tooltip>
            </p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3.5">
          <span className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 14l-5-5-5 5" />
              <path d="M12 3v12" />
              <path d="M5 21h14" />
            </svg>
          </span>
          <div>
            <div className="text-lg font-bold text-[#0f172a]">
              ~{formatNumber(impact.equivalent_trees)}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">Tree-years of carbon capture
              <Tooltip text="Equivalent number of mature trees needed to absorb the same amount of CO₂ over one year. One mature tree sequesters approximately 21 kg of CO₂ annually.">
                <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center cursor-help text-[8px] font-bold leading-none">?</span>
              </Tooltip>
            </p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3.5">
          <span className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </span>
          <div>
            <div className="text-lg font-bold text-[#0f172a]">
              ${impact.money_saved.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">Estimated value recovered
              <Tooltip text="Estimated financial value generated from fulfilled pledges. Based on reuse value: $15 per donated item, $25 per resold item, $5 per recycled item.">
                <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center cursor-help text-[8px] font-bold leading-none">?</span>
              </Tooltip>
            </p>
          </div>
        </div>
      </div>

      {impact.items_diverted > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600 pt-4 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Breakdown
          </span>
          {['donate', 'sell', 'recycle'].map((action) => {
            const a = impact.by_action[action as keyof ImpactByAction];
            const meta = ACTION_META[action];
            if (a.count === 0) return null;
            return (
              <span key={action} className="flex items-center gap-1.5">
                <span className="text-xs">{meta.icon}</span>
                <span className="text-gray-500">{meta.label}</span>
                <span className="font-semibold text-[#0f172a]">{a.count}</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400">{a.co2_kg} kg CO₂</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
