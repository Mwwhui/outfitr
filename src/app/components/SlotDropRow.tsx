'use client';
import Image from 'next/image';

import React from 'react';

export interface ClothingItem {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
  favorite?: boolean;
  use_case?: string[];
}

export type OutfitSlotKey = 'top' | 'bottom' | 'onepiece' | 'outerwear';

interface SlotDropProps {
  label: string;
  slotKey: OutfitSlotKey;
  item: ClothingItem | null;
  onDrop: (slot: OutfitSlotKey, id: string) => void;
  onClear: (slot: OutfitSlotKey) => void;
}

export default function SlotDropRow({
  label,
  slotKey,
  item,
  onDrop,
  onClear,
}: SlotDropProps) {
  return (
    <div
      className="w-full h-64 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:border-slate-400 hover:bg-slate-50/40 transition relative overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDrop(slotKey, id);
      }}
    >
      {!item && (
        <div className="flex flex-col items-center gap-1 select-none">
          <div className="text-3xl text-slate-300 mb-1">＋</div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="text-xs text-slate-300">Drag from wardrobe</p>
        </div>
      )}

      {item && (
        <div className="relative w-full h-full group">
          <Image
            fill
            src={item.image_url || ''}
            alt={item.name}
            className="object-cover rounded-2xl"
          />

          <button
            onClick={() => onClear(slotKey)}
            className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black opacity-0 group-hover:opacity-100 transition"
          >
            ×
          </button>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 rounded-b-2xl">
            <p className="text-white text-xs font-medium truncate">
              {item.name}
            </p>
            <p className="text-white/70 text-[10px] truncate">{label}</p>
            {item.use_case && item.use_case.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.use_case.map((uc) => (
                  <span
                    key={uc}
                    className="text-[8px] uppercase tracking-wider text-white/60 bg-white/10 rounded px-1 py-[1px]"
                  >
                    {uc}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
