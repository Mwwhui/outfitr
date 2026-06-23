'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface ComboItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
}

interface FrequentCombo {
  key: string;
  frequency: number;
  last_worn: string;
  days_since_worn: number;
  name: string | null;
  items: ComboItem[];
}

interface OutfitDNA {
  formula: string;
  color_habits: string[];
  strong_pairs: Array<{ item_a: string; item_b: string; count: number }>;
  never_tried: Array<{ item_a: string; item_b: string; reason: string }>;
  pattern_breakers: Array<{ combo: string[]; combo_items: ComboItem[]; reason: string }>;
  style_summary: string;
}

interface AISuggestion {
  items: ComboItem[];
  score: number;
  ai_reasoning: string;
  style: string;
  color_harmony: number;
}

// Flat-lay positioning for each item type
const LAYOUT_POSITIONS: Record<string, { x: number; y: number; w: number; h: number; rotate: number; z: number }> = {
  'Outerwear':  { x: 52, y: 5,  w: 44, h: 45, rotate: -2, z: 3 },
  'Tops':       { x: 4,  y: 8,  w: 50, h: 42, rotate: 1,  z: 2 },
  'One-Piece':  { x: 12, y: 5,  w: 74, h: 55, rotate: 0,  z: 2 },
  'Bottoms':    { x: 6,  y: 50, w: 52, h: 40, rotate: -1, z: 1 },
  'Shoes':      { x: 14, y: 82, w: 32, h: 16, rotate: 2,  z: 0 },
  'Accessories':{ x: 62, y: 60, w: 28, h: 22, rotate: -3, z: 4 },
};

function FlatLayCanvas({ items, aspect = '4/5' }: { items: ComboItem[]; aspect?: string }) {
  const placed = items.map((item) => {
    const pos = LAYOUT_POSITIONS[item.type] || { x: 10, y: 10, w: 40, h: 30, rotate: 0, z: 0 };
    return { ...item, ...pos };
  });

  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100"
      style={{ aspectRatio: aspect }}
    >
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_1px_1px,_#94a3b8_1px,_transparent_0)] bg-[length:16px_16px]" />

      {placed.map((item) => (
        <div
          key={item.id}
          className="absolute rounded-xl overflow-hidden shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-lg hover:z-50"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            width: `${item.w}%`,
            height: `${item.h}%`,
            transform: `rotate(${item.rotate}deg)`,
            zIndex: item.z,
          }}
        >
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: item.color || '#cbd5e1' }}
            >
              <span className="text-[10px] font-medium text-white/70 drop-shadow-sm">
                {item.type}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ModelSilhouette() {
  return (
    <svg viewBox="0 0 200 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Head */}
      <ellipse cx="100" cy="45" rx="28" ry="34" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Neck */}
      <rect x="88" y="78" width="24" height="18" rx="4" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />
      {/* Shoulders + Torso */}
      <path d="M88 96 Q50 102 38 130 L42 260 L80 268 L100 270 L120 268 L158 260 L162 130 Q150 102 112 96 Z" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Left arm */}
      <path d="M38 130 Q22 180 18 230 Q16 245 22 248" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" fill="none" />
      {/* Right arm */}
      <path d="M162 130 Q178 180 182 230 Q184 245 178 248" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" fill="none" />
      {/* Left leg */}
      <path d="M80 268 Q72 350 68 440 Q66 465 60 470" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Right leg */}
      <path d="M120 268 Q128 350 132 440 Q134 465 140 470" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ColorPaletteStrip({ items }: { items: ComboItem[] }) {
  const colors = items
    .filter((i) => i.color)
    .map((i) => i.color!)
    .filter((c, idx, arr) => arr.indexOf(c) === idx)
    .slice(0, 6);

  if (colors.length === 0) return null;

  return (
    <div className="flex gap-1">
      {colors.map((color, i) => (
        <div
          key={i}
          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-sm bg-white/80 border border-white/40 rounded-2xl shadow-lg shadow-black/5 ${className}`}>
      {children}
    </div>
  );
}

export default function OutfitsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [frequentCombos, setFrequentCombos] = useState<FrequentCombo[]>([]);
  const [dna, setDna] = useState<OutfitDNA | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDna, setLoadingDna] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [totalOutfits, setTotalOutfits] = useState(0);
  const [uniqueCombos, setUniqueCombos] = useState(0);
  const [mounted, setMounted] = useState(false);

  const buildPlannerUrl = (items: ComboItem[], date?: string) => {
    const params = new URLSearchParams();
    params.set('date', date || new Date().toISOString().slice(0, 10));
    params.set('timeSlot', 'day');
    for (const item of items) {
      const slotKey = item.type === 'Tops' ? 'top'
        : item.type === 'Bottoms' ? 'bottom'
        : item.type === 'Outerwear' ? 'outerwear'
        : item.type === 'One-Piece' ? 'onepiece'
        : null;
      if (slotKey) params.set(slotKey, item.id);
    }
    return `/planner?${params.toString()}`;
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/outfits/frequent?limit=10');
        if (res.ok) {
          const data = await res.json();
          setFrequentCombos(data.combos || []);
          setTotalOutfits(data.total_outfits || 0);
          setUniqueCombos(data.unique_combos || 0);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [session?.user?.id]);

  const fetchDNA = async () => {
    if (!session?.user?.id || loadingDna) return;
    setLoadingDna(true);
    try {
      const res = await fetch('/api/outfits/dna', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) setDna(await res.json());
    } catch (e) { console.error(e); } finally { setLoadingDna(false); }
  };

  const fetchSuggestions = async () => {
    if (!session?.user?.id || loadingSuggestions) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch('/api/outfits/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) { const data = await res.json(); setSuggestions(data.suggestions || []); }
    } catch (e) { console.error(e); } finally { setLoadingSuggestions(false); }
  };

  useEffect(() => {
    if (session?.user?.id && !loading) { fetchDNA(); fetchSuggestions(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, loading]);

  const rotationSuggestions = frequentCombos.filter((c) => c.days_since_worn >= 14);

  if (status === 'loading' || loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (<div key={i} className="h-72 bg-slate-100 rounded-2xl" />))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
      {/* Header */}
      <div className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-4xl font-bold tracking-tight mb-1">Style Lab</h1>
        <p className="text-sm text-slate-500">{totalOutfits} outfits worn · {uniqueCombos} unique combinations</p>
      </div>

      {/* Outfit DNA Card */}
      {dna && (
        <GlassCard className={`p-6 bg-gradient-to-br from-slate-900/90 to-slate-800/90 text-white border-slate-700/30 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-400 text-lg">✦</span>
            <h2 className="text-lg font-semibold">Your Outfit DNA</h2>
          </div>
          <p className="text-slate-300 text-sm mb-4">{dna.style_summary}</p>
          {frequentCombos.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Your palette</p>
              <ColorPaletteStrip items={frequentCombos.flatMap((c) => c.items)} />
            </div>
          )}
          {dna.formula && (
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-xs mb-4">
              <span className="text-amber-400">Formula:</span>
              <span className="font-medium">{dna.formula}</span>
            </div>
          )}
          {dna.color_habits.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {dna.color_habits.map((habit, i) => (
                <span key={i} className="text-[11px] bg-white/5 border border-white/10 rounded-full px-2.5 py-1">{habit}</span>
              ))}
            </div>
          )}
          {dna.strong_pairs.length > 0 && (
            <div className="text-xs text-slate-400">
              Strongest pairs: {dna.strong_pairs.slice(0, 3).map((p) => `${p.item_a} + ${p.item_b} (${p.count}×)`).join(' · ')}
            </div>
          )}
        </GlassCard>
      )}
      {!dna && !loading && (
        <button onClick={fetchDNA} disabled={loadingDna}
          className={`w-full text-left transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <GlassCard className="p-6 bg-gradient-to-br from-slate-900/90 to-slate-800/90 text-white border-slate-700/30 hover:from-slate-800/90 hover:to-slate-700/90">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400 text-lg">✦</span>
              <h2 className="text-lg font-semibold">Unlock Your Outfit DNA</h2>
            </div>
            <p className="text-slate-300 text-sm">
              {loadingDna ? 'Analyzing your style patterns...' : 'AI analyzes your wearing patterns to find your unique style formula.'}
            </p>
          </GlassCard>
        </button>
      )}

      {/* Most Worn Combos — Flat-Lay Grid */}
      {frequentCombos.length > 0 && (
        <section className={`transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-lg font-semibold mb-4">Most Worn Combos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {frequentCombos.map((combo, i) => (
              <div key={combo.key} className="transition-all duration-500" style={{ transitionDelay: `${i * 50}ms` }}>
                <GlassCard className="overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                  <FlatLayCanvas items={combo.items} />
                  <div className="p-3">
                    {combo.name && (
                      <p className="text-xs font-medium text-slate-700 truncate mb-1">{combo.name}</p>
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-slate-800">{combo.frequency}×</span>
                      <span className="text-[10px] text-slate-400">
                        {combo.days_since_worn === 0 ? 'Today' : `${combo.days_since_worn}d ago`}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{combo.items.map((i) => i.name).join(' + ')}</p>
                    {combo.items.some((i) => i.season) && (
                      <div className="flex gap-1 mt-1.5">
                        {[...new Set(combo.items.map((i) => i.season).filter(Boolean))].slice(0, 2).map((s) => (
                          <span key={s} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => router.push(buildPlannerUrl(combo.items))}
                      className="mt-2 w-full text-xs py-1.5 rounded-lg bg-black text-white hover:bg-slate-800 transition opacity-0 group-hover:opacity-100"
                    >
                      Wear Today
                    </button>
                  </div>
                </GlassCard>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Rotation — Model + Flat-Lay Layout */}
      {rotationSuggestions.length > 0 && (
        <section className={`transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-lg font-semibold mb-1">AI Rotation Suggestions</h2>
          <p className="text-xs text-slate-500 mb-4">Combos you love but haven&apos;t worn recently</p>
          <div className="space-y-4">
            {rotationSuggestions.slice(0, 3).map((combo, i) => (
              <GlassCard key={combo.key} className="overflow-hidden hover:shadow-xl transition-all"
                style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="flex flex-col sm:flex-row">
                  {/* Model silhouette — left side */}
                  <div className="sm:w-48 h-56 sm:h-auto bg-gradient-to-b from-slate-50 to-slate-100 relative shrink-0 flex items-center justify-center p-4">
                    <ModelSilhouette />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg px-2 py-1.5 text-center">
                        <span className="text-[10px] text-slate-500">Styled for you</span>
                      </div>
                    </div>
                  </div>
                  {/* Flat-lay — right side */}
                  <div className="flex-1 flex flex-col">
                    <div className="p-4 pb-0">
                      <FlatLayCanvas items={combo.items} aspect="16/9" />
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            {combo.frequency}× worn
                          </span>
                          <span className="text-[10px] text-slate-400">Last: {combo.days_since_worn} days ago</span>
                        </div>
                        <p className="text-sm text-slate-700 truncate">{combo.items.map((i) => i.name).join(' + ')}</p>
                      </div>
                      <button
                        onClick={() => router.push(buildPlannerUrl(combo.items))}
                        className="text-xs px-4 py-2 rounded-lg bg-black text-white hover:bg-slate-800 transition shrink-0"
                      >
                        Wear Today
                      </button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* AI New Combos — Horizontal Scrollable Grid */}
      {suggestions.length > 0 && (
        <section className={`transition-all duration-700 delay-[400ms] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-lg font-semibold mb-1">AI Says Try This</h2>
          <p className="text-xs text-slate-500 mb-4">Fresh combinations based on your style patterns</p>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {suggestions.map((s, i) => (
              <GlassCard key={i}
                className={`min-w-[280px] max-w-[320px] snap-start shrink-0 transition-all hover:shadow-xl ${
                  s.style === 'adventurous' ? 'ring-1 ring-amber-200 bg-amber-50/80' : ''
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}>
                <FlatLayCanvas items={s.items} aspect="4/3" />
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    {s.style === 'adventurous' ? (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pattern Breaker</span>
                    ) : (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Matches Style</span>
                    )}
                    <span className="text-[10px] text-slate-400">{s.score}/100</span>
                    {s.color_harmony > 0 && (
                      <span className="text-[10px] text-slate-400">· {s.color_harmony}/20</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 mb-1 truncate">{s.items.map((it) => it.name).join(' + ')}</p>
                  <p className="text-[10px] text-slate-500 italic mb-2 line-clamp-2">&ldquo;{s.ai_reasoning}&rdquo;</p>
                  <button
                    onClick={() => router.push(buildPlannerUrl(s.items))}
                    className="w-full text-xs py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                  >
                    Try This
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* Pattern Breakers — Flat-Lay Cards */}
      {dna && dna.pattern_breakers.length > 0 && (
        <section className={`transition-all duration-700 delay-[500ms] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-lg font-semibold mb-1">Pattern Breakers</h2>
          <p className="text-xs text-slate-500 mb-4">AI found patterns you always follow — and suggests breaking them</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dna.pattern_breakers.map((pb, i) => (
              <GlassCard key={i} className="overflow-hidden ring-1 ring-orange-200 bg-orange-50/80"
                style={{ transitionDelay: `${i * 80}ms` }}>
                {pb.combo_items && pb.combo_items.length > 0 && (
                  <FlatLayCanvas items={pb.combo_items} aspect="16/9" />
                )}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-orange-500 text-sm">⚡</span>
                    <span className="text-xs font-medium text-orange-700">Try Something New</span>
                  </div>
                  <p className="text-sm text-slate-700 mb-1">{pb.combo.join(' + ')}</p>
                  <p className="text-xs text-slate-500 italic">{pb.reason}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* Unexplored Combos */}
      {dna && dna.never_tried.length > 0 && (
        <section className={`transition-all duration-700 delay-[600ms] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-lg font-semibold mb-1">Unexplored Combos</h2>
          <p className="text-xs text-slate-500 mb-4">Pairs you own but have never combined</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dna.never_tried.slice(0, 4).map((nt, i) => (
              <GlassCard key={i} className="p-3 hover:shadow-lg transition-all" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{nt.item_a} + {nt.item_b}</p>
                    <p className="text-xs text-slate-500 mt-1">{nt.reason}</p>
                  </div>
                  <button onClick={() => router.push('/planner')}
                    className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition shrink-0">
                    Try This
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!loading && frequentCombos.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">👔</div>
          <h2 className="text-lg font-semibold mb-2">No outfits yet</h2>
          <p className="text-sm text-slate-500 mb-4">Start planning outfits to see your most-worn combos here.</p>
          <button onClick={() => router.push('/planner')}
            className="px-6 py-2.5 rounded-lg bg-black text-white text-sm hover:bg-slate-800 transition">
            Open Planner
          </button>
        </div>
      )}
    </div>
  );
}
