'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Loader from '../components/Loader';
import SlotDropRow from '../components/SlotDropRow';
import Button from '../components/Button';
import toast from 'react-hot-toast';

// ─────────────────────────────
// TYPES
// ─────────────────────────────

interface ClothingItem {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  favorite?: boolean;
}

type OutfitSlotKey = 'top' | 'bottom' | 'onepiece' | 'outerwear';

interface SlotsState {
  top: ClothingItem | null;
  bottom: ClothingItem | null;
  onepiece: ClothingItem | null;
  outerwear: ClothingItem | null;
}

// Slot labels
const SLOT_LABELS: Record<OutfitSlotKey, string> = {
  top: 'Top',
  bottom: 'Bottoms',
  outerwear: 'Outerwear',
  onepiece: 'One-Piece',
};

// Category sorting priority (for left wardrobe)
const CATEGORY_ORDER: Record<string, number> = {
  Onepiece: 4,
  Bottoms: 2,
  Outerwear: 3,
  Tops: 1,
};

export default function PlannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [clothes, setClothes] = useState<ClothingItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [timeSlot, setTimeSlot] = useState<'day' | 'night'>('day');
  const [outfitName, setOutfitName] = useState('');

  const EMPTY_SLOTS: SlotsState = {
    top: null,
    bottom: null,
    onepiece: null,
    outerwear: null,
  };

  const [slots, setSlots] = useState<SlotsState>(EMPTY_SLOTS);
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const qpDate = searchParams.get('date');
    const qpTimeSlot = searchParams.get('timeSlot');

    if (qpDate) setSelectedDate(qpDate);
    if (qpTimeSlot === 'day' || qpTimeSlot === 'night') setTimeSlot(qpTimeSlot);

    setUrlReady(true);
  }, [searchParams]);

  useEffect(() => {
    if (!urlReady) return;
    if (status !== 'authenticated') return;

    const controller = new AbortController();

    async function loadOutfit() {
      setSlots(EMPTY_SLOTS);

      try {
        const res = await fetch(
          `/api/outfit_plans?from=${selectedDate}&to=${selectedDate}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;

        const data = await res.json();
        const found = (data || []).find((o: any) => o.time_slot === timeSlot);

        if (!controller.signal.aborted) {
          setSlots(found?.slots ?? EMPTY_SLOTS);
          setOutfitName(found?.name ?? '');
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error(e);
      }
    }

    loadOutfit();
    return () => controller.abort();
  }, [urlReady, selectedDate, timeSlot, status]);

  // Fetch wardrobe items
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated') {
      fetchClothes();
    }
  }, [status]);

  const fetchClothes = async () => {
    try {
      const res = await fetch(`/api/clothes?user_id=${session?.user?.id}`);
      if (!res.ok) {
        console.error('Failed to fetch clothes for planner:', await res.text());
        setClothes([]);
      } else {
        const data = await res.json();
        if (Array.isArray(data)) {
          setClothes(data);
        } else {
          console.error('Invalid clothes response:', data);
          setClothes([]);
        }
      }
    } catch (err) {
      console.error('Error fetching clothes for planner:', err);
      setClothes([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of clothes) {
      if (c.type?.trim()) set.add(c.type.trim());
    }

    const arr = Array.from(set);
    arr.sort(
      (a, b) =>
        (CATEGORY_ORDER[a] ?? 999) - (CATEGORY_ORDER[b] ?? 999) ||
        a.localeCompare(b),
    );

    return ['All', ...arr];
  }, [clothes]);

  // Wardrobe sidebar list, sorted by category → favourite → name
  const sidebarClothes = useMemo(() => {
    if (!Array.isArray(clothes)) return [];

    const filtered =
      selectedCategory === 'All'
        ? clothes
        : clothes.filter((c) => (c.type ?? '').trim() === selectedCategory);

    const orderForType = (t?: string | null) =>
      t ? (CATEGORY_ORDER[t] ?? 999) : 999;

    return [...filtered].sort((a, b) => {
      const cat = orderForType(a.type) - orderForType(b.type);
      if (cat !== 0) return cat;

      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;

      return a.name.localeCompare(b.name);
    });
  }, [clothes, selectedCategory]);

  // Drag & drop: drop item onto slot
  const handleDrop = (slot: OutfitSlotKey, clothingId: string) => {
    const item = clothes.find((c) => c.id === clothingId);
    if (!item) return;

    setSlots((prev) => ({
      ...prev,
      [slot]: item,
    }));
  };

  const handleClearSlot = (slot: OutfitSlotKey) => {
    setSlots((prev) => ({
      ...prev,
      [slot]: null,
    }));
  };

  if (loading) {
    return <Loader message="Loading planner..." />;
  }

  async function handleSaveOutfit() {
    const toastId = toast.loading('Saving outfit...');

    try {
      const res = await fetch('/api/outfit_plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          timeSlot,
          slots,
          name: outfitName,
        }),
      });

      if (!res.ok) {
        toast.error('Failed to save outfit', { id: toastId });
        return;
      }

      toast.success(
        timeSlot === 'day' ? 'Day outfit saved!' : 'Night outfit saved!',
        { id: toastId },
      );
    } catch {
      toast.error('Network error', { id: toastId });
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#163422]">Plan My Outfit</h1>

          <div className="flex gap-6 border-b border-slate-200">
          {/* Wardrobe Tab */}
          <button
            onClick={() => router.push('/wardrobe')}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === '/wardrobe'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            {/* Closet Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="4" y="3" width="16" height="18" rx="1.5" />
              <line x1="12" y1="3" x2="12" y2="21" />
              <circle cx="9" cy="12" r="0.6" />
              <circle cx="15" cy="12" r="0.6" />
            </svg>
            Wardrobe
          </button>

          {/* Plan Outfit Tab */}
          <button
            onClick={() => router.push('/planner')}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === '/planner'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            {/* Pencil Note Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="4" y="4" width="11" height="16" rx="1.4" />
              <line x1="7" y1="8" x2="13" y2="8" />
              <line x1="7" y1="11" x2="12" y2="11" />
              <path d="M15.5 9.5l3.2-3.2a1.4 1.4 0 0 1 2 2l-3.2 3.2-2.4.4.4-2.4z" />
            </svg>
            Plan Outfit
          </button>

          {/* Calendar Tab */}
          <button
            onClick={() => router.push('/calendar')}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === '/calendar'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            {/* Calendar Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="3.5" y="5" width="17" height="15" rx="2" />
              <line x1="3.5" y1="9" x2="20.5" y2="9" />
              <line x1="9" y1="3" x2="9" y2="7" />
              <line x1="15" y1="3" x2="15" y2="7" />
              <circle cx="9" cy="13" r="0.7" />
              <circle cx="15" cy="13" r="0.7" />
              <circle cx="9" cy="17" r="0.7" />
              <circle cx="15" cy="17" r="0.7" />
            </svg>
            Calendar
          </button>
        </div>
      </div>
    </div>

    <div className="px-6 pb-16 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        {/* Date picker */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Outfit Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white text-black shadow-sm"
          />
        </div>

        {/* Day/Night toggle */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Time Slot
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTimeSlot('day')}
              className={`px-4 py-2 rounded-xl border text-sm transition inline-flex items-center gap-1.5 ${
                timeSlot === 'day'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-slate-200 hover:bg-slate-50'
              }`}
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="10" r="3.5" />
                <line x1="10" y1="1" x2="10" y2="3" />
                <line x1="10" y1="17" x2="10" y2="19" />
                <line x1="1" y1="10" x2="3" y2="10" />
                <line x1="17" y1="10" x2="19" y2="10" />
                <line x1="3.5" y1="3.5" x2="4.9" y2="4.9" />
                <line x1="15.1" y1="15.1" x2="16.5" y2="16.5" />
                <line x1="3.5" y1="16.5" x2="4.9" y2="15.1" />
                <line x1="15.1" y1="4.9" x2="16.5" y2="3.5" />
              </svg>
              <span>Day</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeSlot('night')}
              className={`px-4 py-2 rounded-xl border text-sm transition inline-flex items-center gap-1.5 ${
                timeSlot === 'night'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-slate-200 hover:bg-slate-50'
              }`}
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 10.7a8 8 0 0 1-10.8-10.8A8.5 8.5 0 1 0 17.5 10.7z" />
              </svg>
              <span>Night</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT: wardrobe left, slots right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
        {/* LEFT: WARDROBE SIDEBAR */}
        <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 max-h-[80vh] overflow-hidden">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Wardrobe
          </h2>

          {/* Category pills + clothes grid */}
          <div className="flex flex-col h-[72vh]">
            {/* Horizontal category pills */}
            <div className="flex gap-1.5 mb-3 pb-3 overflow-x-auto border-b border-slate-200 shrink-0">
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      active
                        ? 'bg-black text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Clothes grid (filtered) */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sidebarClothes.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:border-black cursor-grab active:cursor-grabbing transition"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <div className="h-24 flex items-center justify-center text-xs text-slate-400">
                        No Image
                      </div>
                    )}

                    <div className="px-2 py-1">
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.type}
                      </p>
                      <p className="text-[12px] font-medium truncate">
                        {item.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {sidebarClothes.length === 0 && (
                <p className="text-sm text-slate-400 mt-4">
                  No items in this category.
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT: OUTFIT SLOTS */}
        <section className="space-y-4">
          {/* Outfit name input */}
          <div>
            <input
              type="text"
              placeholder="Name your outfit (optional)"
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-black placeholder:text-slate-400 focus:outline-none focus:border-black transition"
            />
          </div>

          {/* 2x2 grid of slot cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <SlotDropRow
                label={SLOT_LABELS.top}
                slotKey="top"
                item={slots.top}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />

              <SlotDropRow
                label={SLOT_LABELS.bottom}
                slotKey="bottom"
                item={slots.bottom}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />
            </div>

            <div className="space-y-6">
              <SlotDropRow
                label={SLOT_LABELS.outerwear}
                slotKey="outerwear"
                item={slots.outerwear}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />

              <SlotDropRow
                label={SLOT_LABELS.onepiece}
                slotKey="onepiece"
                item={slots.onepiece}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />
            </div>
          </div>

          {/* Save + clear actions */}
          <div className="flex justify-end gap-2">
            {(slots.top || slots.bottom || slots.outerwear || slots.onepiece) && (
              <button
                onClick={() => setSlots(EMPTY_SLOTS)}
                className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
              >
                × Clear
              </button>
            )}
            <Button
              size="md"
              onClick={handleSaveOutfit}
            >
              {timeSlot === 'day' ? 'Save Day' : 'Save Night'}
            </Button>
          </div>
        </section>
      </div>
    </div>
    </div>
  );
}
