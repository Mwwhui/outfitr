'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import HangingRod from './HangingRod';
import ShelfView from './ShelfView';
import DrawerFront from './DrawerFront';
import DraggableItem from './DraggableItem';
import { getZoneIcon } from './ZoneIcons';
import ConfirmModal from '../ConfirmModal';
import type { ClothingItem } from '@/hooks/queries/wardrobe';
import type { LocationZone } from '@/hooks/queries/locations';

interface CabinetZoneProps {
  zone: LocationZone;
  items: ClothingItem[];
  editMode: boolean;
  onItemClick: (item: ClothingItem) => void;
  onDeleteZone?: (id: string) => void;
  onTogglePin?: (id: string) => void;
}

export default function CabinetZone({
  zone,
  items,
  editMode,
  onItemClick,
  onDeleteZone,
  onTogglePin,
}: CabinetZoneProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = getZoneIcon(zone.type);
  const tintStyle = zone.color
    ? { background: `linear-gradient(135deg, ${zone.color}08, transparent 60%)` }
    : undefined;

  return (
    <div className={`zone-shell ${editMode ? 'editing' : ''}`} style={tintStyle}>
      <div className={`zone-header ${editMode && !zone.pinned ? 'drag-handle' : ''} ${zone.pinned ? 'pinned' : ''}`}>
        <Icon style={{ color: zone.color || '#94a3b8' }} />
        <span className="zone-title font-headline">{zone.name}</span>
        <span className="zone-count">{items.length}</span>
        {editMode && onTogglePin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(zone.id);
            }}
            className={`p-1 rounded transition hover:bg-surface-container-high ${zone.pinned ? 'text-amber-600' : 'text-on-surface-variant'} opacity-60 hover:opacity-100`}
            title={zone.pinned ? 'Unpin zone' : 'Pin zone'}
          >
            <span className="material-symbols-outlined text-sm">{zone.pinned ? 'keep' : 'push_pin'}</span>
          </button>
        )}
        {editMode && onDeleteZone && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            className="p-1 rounded transition hover:bg-red-100 opacity-60 hover:opacity-100"
            title="Delete zone"
          >
            <span className="material-symbols-outlined text-sm text-red-500">close</span>
          </button>
        )}
      </div>

      {zone.type === 'hanging' && (
        <HangingRod items={items} onItemClick={onItemClick} zoneId={zone.id} />
      )}

      {zone.type === 'shelf' && (
        <ShelfView items={items} onItemClick={onItemClick} zoneId={zone.id} />
      )}

      {zone.type === 'drawer' && (
        <DrawerFront
          zone={zone}
          items={items}
          onItemClick={onItemClick}
        />
      )}

      {zone.type === 'other' && (
        <OtherZone items={items} onItemClick={onItemClick} zoneId={zone.id} />
      )}

      <ConfirmModal
        open={confirmDelete}
        title={`Delete "${zone.name}"?`}
        message="Items in this zone will move to the Inbox."
        onConfirm={() => {
          setConfirmDelete(false);
          onDeleteZone?.(zone.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function OtherZone({
  items,
  onItemClick,
  zoneId,
}: {
  items: ClothingItem[];
  onItemClick?: (item: ClothingItem) => void;
  zoneId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: zoneId,
    data: { zoneId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`shelf-zone ${isOver ? 'zone-drop-active' : ''}`}
    >
      <div className="shelf-items">
        {items.length > 0 ? (
          items.map((item) => (
            <DraggableItem key={item.id} item={item} onClick={onItemClick} />
          ))
        ) : (
          <span className="empty-hint">
            <span className="material-symbols-outlined empty-hint-icon">inventory_2</span>
            Drag items here
          </span>
        )}
      </div>
    </div>
  );
}