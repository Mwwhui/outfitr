'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { ClothingItem } from '@/hooks/queries/wardrobe';
import type { LocationZone, ClosetLayoutItem } from '@/hooks/queries/locations';
import { useSaveClosetLayout } from '@/hooks/mutations/layout';
import { useTogglePinZone } from '@/hooks/mutations/locations';
import Cabinet from './Cabinet';
import CabinetZone from './CabinetZone';
import UnassignedInbox from './UnassignedInbox';
import { WardrobeIcon } from './ZoneIcons';
import ZoneManager from './ZoneManager';

function groupItemsByZone(
  items: ClothingItem[],
  zones: LocationZone[]
): Record<string, ClothingItem[]> {
  const map: Record<string, ClothingItem[]> = {};
  zones.forEach((z) => {
    map[z.id] = [];
  });
  map['unassigned'] = [];

  items.forEach((item) => {
    const zoneId = item.zone_id;
    if (zoneId && map[zoneId] !== undefined) {
      map[zoneId].push(item);
    } else {
      map['unassigned'].push(item);
    }
  });

  Object.keys(map).forEach((key) => {
    map[key].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  });

  return map;
}

function generateAutoLayout(zones: LocationZone[]): ClosetLayoutItem[] {
  const hanging = zones.filter((z) => z.type === 'hanging');
  const shelves = zones.filter((z) => z.type === 'shelf');
  const drawers = zones.filter((z) => z.type === 'drawer');
  const others = zones.filter((z) => z.type === 'other');

  const layout: ClosetLayoutItem[] = [];
  let y = 0;

  hanging.forEach((zone, i) => {
    const colsPerZone = Math.floor(12 / Math.max(hanging.length, 1));
    layout.push({
      i: zone.id,
      x: colsPerZone * i,
      y,
      w: colsPerZone,
      h: 5,
      minW: 3,
      minH: 3,
    });
  });
  if (hanging.length) y += 5;

  shelves.forEach((zone, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    layout.push({
      i: zone.id,
      x: col * 6,
      y: y + row * 4,
      w: 6,
      h: 4,
      minW: 3,
      minH: 3,
    });
  });
  if (shelves.length) y += Math.ceil(shelves.length / 2) * 4;

  drawers.forEach((zone, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    layout.push({
      i: zone.id,
      x: col * 4,
      y: y + row * 3,
      w: 4,
      h: 3,
      minW: 2,
      minH: 2,
    });
  });
  if (drawers.length) y += Math.ceil(drawers.length / 3) * 3;

  others.forEach((zone, i) => {
    layout.push({
      i: zone.id,
      x: 0,
      y: y + i * 3,
      w: 12,
      h: 3,
      minW: 4,
      minH: 2,
    });
  });

  return layout;
}

function syncLayoutWithZones(
  saved: ClosetLayoutItem[],
  zones: LocationZone[]
): ClosetLayoutItem[] {
  const zoneIds = new Set(zones.map((z) => z.id));
  const existing = new Map(saved.map((item) => [item.i, item]));

  const synced: ClosetLayoutItem[] = saved
    .filter((item) => zoneIds.has(item.i))
    .map((item) => ({ ...item }));

  const maxY = synced.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  let rowY = maxY;
  let rowX = 0;

  zones.forEach((zone) => {
    if (existing.has(zone.id)) return;
    const w = zone.type === 'drawer' ? 4 : 6;
    const h = zone.type === 'hanging' ? 5 : zone.type === 'drawer' ? 3 : 4;

    if (rowX + w > 12) {
      rowY += h;
      rowX = 0;
    }

    synced.push({
      i: zone.id,
      x: rowX,
      y: rowY,
      w,
      h,
      minW: zone.type === 'drawer' ? 2 : 3,
      minH: zone.type === 'drawer' ? 2 : 3,
    });
    rowX += w;
  });

  return synced.sort((a, b) => a.y - b.y);
}

function OverlayItem({ item }: { item: ClothingItem }) {
  return (
    <div className="w-20 shrink-0 opacity-90">
      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface-variant border border-outline-variant shadow-lg relative">
        {item.image_url ? (
          <Image
            fill
            src={item.image_url}
            alt={item.name}
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl text-on-surface-variant">
              checkroom
            </span>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-center text-on-surface truncate px-0.5 leading-tight">
        {item.name}
      </p>
    </div>
  );
}

interface ClosetFloorplanProps {
  items: ClothingItem[];
  zones: LocationZone[];
  layout: ClosetLayoutItem[];
  userId?: string;
  onRefetch: () => void;
}

export default function ClosetFloorplan({
  items,
  zones,
  layout: savedLayout,
  userId,
  onRefetch,
}: ClosetFloorplanProps) {
  const router = useRouter();
  const saveLayout = useSaveClosetLayout(userId);
  const togglePin = useTogglePinZone(userId);

  const [editMode, setEditMode] = useState(false);
  const [activeItem, setActiveItem] = useState<ClothingItem | null>(null);
  const [groupedItems, setGroupedItems] = useState<Record<string, ClothingItem[]>>(
    () => groupItemsByZone(items, zones)
  );
  const [currentLayout, setCurrentLayout] = useState<ClosetLayoutItem[]>([]);
  const [zoneManagerOpen, setZoneManagerOpen] = useState(false);
  const [layoutInitialized, setLayoutInitialized] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    setGroupedItems(groupItemsByZone(items, zones));
  }, [items, zones]);

  useEffect(() => {
    if (savedLayout.length > 0 && zones.length > 0) {
      const synced = syncLayoutWithZones(savedLayout, zones);
      setCurrentLayout(synced);
      setLayoutInitialized(true);
    } else if (zones.length > 0 && !layoutInitialized) {
      const auto = generateAutoLayout(zones);
      setCurrentLayout(auto);
      setLayoutInitialized(true);
    }
  }, [savedLayout, zones, layoutInitialized]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (editMode) return;
      const item = items.find((i) => i.id === event.active.id);
      if (item) setActiveItem(item);
    },
    [items, editMode]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveItem(null);

      if (!over || editMode) return;

      const itemId = active.id as string;
      const overId = over.id as string;

      // Find source zone
      let sourceZoneId = 'unassigned';
      for (const [zoneId, zoneItems] of Object.entries(groupedItems)) {
        if (zoneItems.some((i) => i.id === itemId)) {
          sourceZoneId = zoneId;
          break;
        }
      }

      // Determine if overId is a zone or an item
      const isZoneOver = zones.some((z) => z.id === overId) || overId === 'unassigned';

      let targetZoneId = 'unassigned';
      let overItemIndex = -1;

      if (isZoneOver) {
        targetZoneId = overId;
      } else {
        // overId is an item ID — find its zone and index
        for (const [zoneId, zoneItems] of Object.entries(groupedItems)) {
          const idx = zoneItems.findIndex((i) => i.id === overId);
          if (idx !== -1) {
            targetZoneId = zoneId;
            overItemIndex = idx;
            break;
          }
        }
      }

      if (sourceZoneId === targetZoneId) {
        if (isZoneOver) return; // Dropped on same zone background, no-op

        // Same zone: reorder
        const zoneItems = groupedItems[sourceZoneId] || [];
        const oldIndex = zoneItems.findIndex((i) => i.id === itemId);
        const newIndex = overItemIndex;

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const reordered = arrayMove(zoneItems, oldIndex, newIndex);

        setGroupedItems((prev) => ({
          ...prev,
          [sourceZoneId]: reordered,
        }));

        const updates = reordered.map((item, idx) => ({
          id: item.id,
          zone_id: sourceZoneId === 'unassigned' ? null : sourceZoneId,
          sort_order: idx,
        }));

        try {
          const res = await fetch('/api/clothes/batch-reorder', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: updates }),
          });
          if (!res.ok) throw new Error('Failed to save reorder');
          toast.success('Items reordered');
          onRefetch();
        } catch {
          toast.error('Failed to save reorder');
          onRefetch();
        }

        return;
      }

      // Different zone: transfer
      const sourceItems = groupedItems[sourceZoneId] || [];
      const targetItems = groupedItems[targetZoneId] || [];
      const movedItem = sourceItems.find((i) => i.id === itemId);
      if (!movedItem) return;

      // Build new source list (without moved item)
      const newSourceItems = sourceItems.filter((i) => i.id !== itemId);

      // Build new target list (with moved item inserted at position)
      let newTargetItems: ClothingItem[];
      if (overItemIndex >= 0) {
        // Insert at specific position (dropped over an item)
        newTargetItems = [
          ...targetItems.slice(0, overItemIndex),
          { ...movedItem, zone_id: targetZoneId === 'unassigned' ? null : targetZoneId },
          ...targetItems.slice(overItemIndex),
        ];
      } else {
        // Append (dropped on zone background)
        newTargetItems = [
          ...targetItems,
          { ...movedItem, zone_id: targetZoneId === 'unassigned' ? null : targetZoneId },
        ];
      }

      // Update local state
      setGroupedItems((prev) => ({
        ...prev,
        [sourceZoneId]: newSourceItems,
        [targetZoneId]: newTargetItems,
      }));

      // Build API updates
      const updates: Array<{ id: string; zone_id: string | null; sort_order: number }> = [];
      newSourceItems.forEach((item, idx) => {
        updates.push({
          id: item.id,
          zone_id: sourceZoneId === 'unassigned' ? null : sourceZoneId,
          sort_order: idx,
        });
      });
      newTargetItems.forEach((item, idx) => {
        updates.push({
          id: item.id,
          zone_id: targetZoneId === 'unassigned' ? null : targetZoneId,
          sort_order: idx,
        });
      });

      try {
        const res = await fetch('/api/clothes/batch-reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: updates }),
        });
        if (!res.ok) throw new Error('Failed to save changes');
        toast.success('Item moved');
        onRefetch();
      } catch {
        toast.error('Failed to move item');
        onRefetch();
      }
    },
    [groupedItems, onRefetch, editMode, zones]
  );

  const handleItemClick = useCallback(
    (item: ClothingItem) => {
      router.push(`/wardrobe/${item.id}`);
    },
    [router]
  );

  const handleSaveLayout = useCallback(() => {
    saveLayout.mutate(currentLayout, {
      onSuccess: () => {
        toast.success('Layout saved');
        setEditMode(false);
      },
      onError: () => {
        toast.error('Failed to save layout');
      },
    });
  }, [saveLayout, currentLayout]);

  const handleCreateZone = useCallback(
    async (data: { name: string; type: LocationZone['type']; color: string }) => {
      try {
        const res = await fetch('/api/locations/zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create zone');
        toast.success('Zone created');
        onRefetch();
      } catch {
        toast.error('Failed to create zone');
      }
    },
    [onRefetch]
  );

  const handleUpdateZone = useCallback(
    async (id: string, data: Partial<LocationZone>) => {
      try {
        const res = await fetch(`/api/locations/zones/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update zone');
        toast.success('Zone updated');
        onRefetch();
      } catch {
        toast.error('Failed to update zone');
      }
    },
    [onRefetch]
  );

  const handleReorderZones = useCallback(
    async (reorderedZones: LocationZone[]) => {
      try {
        const res = await fetch('/api/locations/zones/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zoneIds: reorderedZones.map((z) => z.id) }),
        });
        if (!res.ok) throw new Error('Failed to reorder zones');
        toast.success('Zone order updated');
        onRefetch();
      } catch {
        toast.error('Failed to reorder zones');
        onRefetch();
      }
    },
    [onRefetch]
  );

  const handleTogglePin = useCallback(
    (zoneId: string) => {
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return;
      const newPinned = !zone.pinned;
      togglePin.mutate(
        { id: zoneId, pinned: newPinned },
        {
          onSuccess: () => toast.success(newPinned ? 'Zone pinned' : 'Zone unpinned'),
          onError: () => toast.error('Failed to toggle pin'),
        },
      );
    },
    [zones, togglePin]
  );

  const handleDeleteZone = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/locations/zones/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete zone');

        const cleanedLayout = currentLayout.filter((item) => item.i !== id);
        await saveLayout.mutateAsync(cleanedLayout);

        toast.success('Zone deleted — items moved to Unassigned');
        onRefetch();
      } catch {
        toast.error('Failed to delete zone');
      }
    },
    [onRefetch, currentLayout, saveLayout]
  );

  const sortedZones = useMemo(() => {
    const orderMap = new Map(currentLayout.map((item, idx) => [item.i, idx]));
    return [...zones].sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? 999;
      const bIdx = orderMap.get(b.id) ?? 999;
      return aIdx - bIdx;
    });
  }, [zones, currentLayout]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoneManagerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container transition"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add Zone
          </button>
          <span className="text-xs text-on-surface-variant">
            {zones.length} zone{zones.length !== 1 ? 's' : ''}
          </span>
        </div>
        {editMode ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditMode(false)}
              className="px-3 py-2 rounded-xl bg-surface-container text-on-surface text-sm font-medium hover:bg-surface-container-high transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLayout}
              disabled={saveLayout.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-lg">check</span>
              {saveLayout.isPending ? 'Saving...' : 'Done'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container transition"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            Edit Layout
          </button>
        )}
      </div>

      {zones.length === 0 ? (
        <div className="cabinet-frame">
          <div className="cabinet-body flex flex-col items-center justify-center py-20 px-6 text-center">
            <WardrobeIcon width={48} height={48} className="text-on-surface-variant mb-4 mx-auto" />
            <p className="text-sm font-semibold text-on-surface mb-1">
              No zones yet
            </p>
            <p className="text-xs text-on-surface-variant mb-4">
              Add zones like hanging rods, shelves, and drawers to design your closet
            </p>
            <button
              onClick={() => setZoneManagerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 transition"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Add Your First Zone
            </button>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Cabinet
            layout={currentLayout}
            onLayoutChange={setCurrentLayout}
            editMode={editMode}
          >
            {sortedZones.map((zone) => (
              <div key={zone.id} style={{ height: '100%' }}>
                <CabinetZone
                  zone={zone}
                  items={groupedItems[zone.id] || []}
                  editMode={editMode}
                  onItemClick={handleItemClick}
                  onDeleteZone={handleDeleteZone}
                  onTogglePin={handleTogglePin}
                />
              </div>
            ))}
          </Cabinet>

          <UnassignedInbox
            items={groupedItems['unassigned'] || []}
            onItemClick={handleItemClick}
          />

          <DragOverlay>
            {activeItem ? <OverlayItem item={activeItem} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <ZoneManager
        open={zoneManagerOpen}
        zones={zones}
        onClose={() => setZoneManagerOpen(false)}
        onCreate={handleCreateZone}
        onUpdate={handleUpdateZone}
        onDelete={handleDeleteZone}
        onReorder={handleReorderZones}
      />
    </div>
  );
}