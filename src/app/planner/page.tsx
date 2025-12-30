'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Loader from '../components/Loader';
import SlotDropRow from '../components/SlotDropRow';

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

type OutfitSlotKey = 'hat' | 'top' | 'bottom' | 'shoes' | 'accessory';

interface SlotsState {
  hat: ClothingItem | null;
  top: ClothingItem | null;
  bottom: ClothingItem | null;
  shoes: ClothingItem | null;
  accessory: ClothingItem | null;
}

// Slot labels
const SLOT_LABELS: Record<OutfitSlotKey, string> = {
  hat: 'Hat',
  top: 'Top',
  bottom: 'Bottoms',
  shoes: 'Shoes',
  accessory: 'Accessories & Bags',
};

// Category sorting priority (for left wardrobe)
const CATEGORY_ORDER: Record<string, number> = {
  Accessories: 1,
  'Accessories & Bags': 1,
  Bags: 2,
  Swimwear: 3,
  Footwear: 4,
  Shoes: 4,
  Bottoms: 5,
  Outerwear: 6,
  Tops: 7,
  Top: 7,
};

// ─────────────────────────────
// MAIN PLANNER PAGE
// ─────────────────────────────

export default function PlannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [clothes, setClothes] = useState<ClothingItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [slots, setSlots] = useState<SlotsState>({
    hat: null,
    top: null,
    bottom: null,
    shoes: null,
    accessory: null,
  });

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
        a.localeCompare(b)
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
      t ? CATEGORY_ORDER[t] ?? 999 : 999;

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

  return (
    <div className="min-h-screen p-6">
      {/* HEADER + TABS */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl text-black font-semibold">Plan My Outfit</h1>

        {/* Tabs: Wardrobe / Plan Outfit / Calendar */}
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

      {/* MAIN LAYOUT: wardrobe left, slots right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] gap-6">
        {/* LEFT: WARDROBE SIDEBAR */}
        <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 max-h-[80vh] overflow-hidden">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Wardrobe
          </h2>

          {/* NEW: category column + clothes grid */}
          <div className="flex gap-4 h-[72vh]">
            {/* Category tabs */}
            <div className="w-40 shrink-0 overflow-y-auto pr-1 border-r border-slate-200">
              <div className="flex flex-col gap-1">
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-left px-3 py-2 rounded-xl text-sm transition ${
                        active
                          ? 'bg-black text-white'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
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

        {/* RIGHT: OUTFIT SLOTS – 2 columns, centered */}
        <div className="flex justify-center w-full">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[650px] w-full">
            {/* Left column: Top / Bottoms / Shoes */}
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

              <SlotDropRow
                label={SLOT_LABELS.shoes}
                slotKey="shoes"
                item={slots.shoes}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />
            </div>

            {/* Right column: Hat / Accessories & Bags */}
            <div className="space-y-6">
              <SlotDropRow
                label={SLOT_LABELS.hat}
                slotKey="hat"
                item={slots.hat}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />

              <SlotDropRow
                label={SLOT_LABELS.accessory}
                slotKey="accessory"
                item={slots.accessory}
                onDrop={handleDrop}
                onClear={handleClearSlot}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
