'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import DraggableItem from './DraggableItem';
import { HangerIcon } from './ZoneIcons';
import type { ClothingItem } from '@/hooks/queries/wardrobe';

export default function HangingRod({
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

  const overlapOffset = items.length > 6 ? '-16px' : items.length > 3 ? '-12px' : '0';

  return (
    <div ref={setNodeRef} className={`hanging-zone ${isOver ? 'zone-drop-active' : ''}`}>
      <div className="rod-bar" />
      <div className="rod-end-cap left" />
      <div className="rod-end-cap right" />
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="hanger-row">
          {items.length > 0 ? (
            items.map((item, idx) => (
              <div
                key={item.id}
                className="hanger-item"
                style={{ marginLeft: idx > 0 ? overlapOffset : '0' }}
              >
                <HangerIcon />
                <DraggableItem item={item} onClick={onItemClick} />
              </div>
            ))
          ) : (
            <span className="empty-hint">
              <HangerIcon width={32} height={26} stroke="#cbd5e1" strokeWidth={1.2} />
              <span className="block mt-1">Drag items here to hang</span>
            </span>
          )}
        </div>
      </SortableContext>
    </div>
  );
}