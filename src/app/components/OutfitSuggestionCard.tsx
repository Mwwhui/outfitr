'use client';

import { useState } from 'react';
import type { SuggestedOutfit } from '@/lib/suggestOutfits';

const TYPE_ICON: Record<string, string> = {
  Tops: '👕',
  Bottoms: '👖',
  Outerwear: '🧥',
  'One-Piece': '👗',
};

interface Props {
  suggestion: SuggestedOutfit;
  saving?: boolean;
  onUse: () => void;
}

function BreakdownRow({
  icon,
  label,
  weight,
  earned,
  detail,
}: {
  icon: string;
  label: string;
  weight: number;
  earned: number;
  detail: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = weight > 0 ? (earned / weight) * 100 : 0;
  const barColor =
    pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left text-xs text-slate-600 hover:bg-slate-100 rounded-lg px-2 py-1.5 transition"
      >
        <span className="shrink-0">{icon}</span>
        <span className="flex-1">{label}</span>
        <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-xs font-medium shrink-0 w-12 text-right">
          {earned}/{weight}
        </span>
        <span className="text-slate-300 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <p className="text-xs text-slate-400 pl-9 pr-2 pb-1.5 leading-relaxed whitespace-pre-line">
          {detail}
        </p>
      )}
    </div>
  );
}

export default function OutfitSuggestionCard({ suggestion, saving, onUse }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const score = suggestion.score;
  const barColor =
    score >= 80
      ? 'bg-green-500'
      : score >= 60
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
      <div className="space-y-2">
        {suggestion.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-14 h-14 rounded-lg object-cover border border-slate-100"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-xl">
                {TYPE_ICON[item.type] || '👕'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-xs text-slate-400 truncate">
                {item.color || ''}{item.color && item.type ? ' · ' : ''}{item.type}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-slate-700 shrink-0">{score}/100</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-600">
          🎨 {suggestion.palette}
        </div>
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="text-xs text-slate-400 hover:text-slate-600 transition flex items-center gap-1"
        >
          {showBreakdown ? '▲' : '▼'} {showBreakdown ? 'Hide' : 'Show'} details
        </button>
      </div>

      {showBreakdown && suggestion.breakdown.length > 0 && (
        <div className="bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100">
          {suggestion.breakdown.map((b) => (
            <BreakdownRow key={b.label} {...b} />
          ))}
        </div>
      )}

      <button
        onClick={onUse}
        disabled={saving}
        className="w-full py-2.5 rounded-lg bg-[#163422] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {saving ? 'Saving...' : 'Use This Outfit'}
      </button>
    </div>
  );
}
