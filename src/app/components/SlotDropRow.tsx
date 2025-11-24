"use client";

import React from "react";

// ─────────────────────────────
// TYPES
// ─────────────────────────────

export interface ClothingItem {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  favorite?: boolean;
}

export type OutfitSlotKey = "hat" | "top" | "bottom" | "shoes" | "accessory";

interface SlotDropProps {
  label: string;
  slotKey: OutfitSlotKey;
  item: ClothingItem | null;
  onDrop: (slot: OutfitSlotKey, id: string) => void;
  onClear: (slot: OutfitSlotKey) => void;
}

// ─────────────────────────────
// SLOT DROP COMPONENT
// ─────────────────────────────

export default function SlotDropRow({
  label,
  slotKey,
  item,
  onDrop,
  onClear,
}: SlotDropProps) {
  return (
    <div
      className="w-full h-56 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:border-black transition relative overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(slotKey, id);
      }}
    >
      {/* ─────────────── EMPTY SLOT ─────────────── */}
      {!item && (
        <>
          <div className="text-3xl mb-2">＋</div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-slate-400 mt-1">
            Drag an item here from wardrobe
          </p>
        </>
      )}

      {/* ─────────────── FILLED SLOT ─────────────── */}
      {item && (
        <div className="relative w-full h-full">
          <img
            src={item.image_url || ""}
            alt={item.name}
            className="w-full h-full object-cover rounded-2xl"
          />

          {/* Clear (X) button */}
          <button
            onClick={() => onClear(slotKey)}
            className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black"
          >
            ×
          </button>

          {/* Label on hover only */}
          <div className="absolute bottom-2 left-2 text-white bg-black/60 px-2 py-1 rounded text-xs opacity-0 hover:opacity-100 transition">
            {label}
          </div>
        </div>
      )}
    </div>
  );
}
