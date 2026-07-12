'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import DraggableItem from './DraggableItem';
import type { ClothingItem } from '@/hooks/queries/wardrobe';

export default function ShelfView({
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
    <div ref={setNodeRef} className={`shelf-zone ${isOver ? 'zone-drop-active' : ''}`}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="shelf-items">
          {items.length > 0 ? (
            items.map((item) => (
              <DraggableItem key={item.id} item={item} onClick={onItemClick} />
            ))
          ) : (
            <span className="empty-hint">
              <span className="material-symbols-outlined empty-hint-icon">shelves</span>
              Drag items to shelf
            </span>
          )}
        </div>
      </SortableContext>
      <div className="shelf-board" />
    </div>
  );
}