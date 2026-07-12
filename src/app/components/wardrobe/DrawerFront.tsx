'use client';

import { useDroppable } from '@dnd-kit/core';
import DraggableItem from './DraggableItem';
import type { ClothingItem } from '@/hooks/queries/wardrobe';
import type { LocationZone } from '@/hooks/queries/locations';

export default function DrawerFront({
  zone,
  items,
  onItemClick,
}: {
  zone: LocationZone;
  items: ClothingItem[];
  onItemClick?: (item: ClothingItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: zone.id,
    data: { zoneId: zone.id },
  });

  return (
    <div ref={setNodeRef} className={`drawer-zone ${isOver ? 'zone-drop-active' : ''}`}>
      <div className="drawer-interior">
        <div className="drawer-items">
          {items.length > 0 ? (
            items.map((item) => (
              <DraggableItem key={item.id} item={item} onClick={onItemClick} />
            ))
          ) : (
            <span className="empty-hint">
              <span className="material-symbols-outlined empty-hint-icon">archive</span>
              Empty drawer
            </span>
          )}
        </div>
      </div>
    </div>
  );
}