'use client';

import { useDroppable } from '@dnd-kit/core';
import DraggableItem from './DraggableItem';
import type { ClothingItem } from '@/hooks/queries/wardrobe';

export default function UnassignedInbox({
  items,
  onItemClick,
}: {
  items: ClothingItem[];
  onItemClick?: (item: ClothingItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned',
    data: { zoneId: 'unassigned' },
  });

  return (
    <div ref={setNodeRef} className={`unassigned-inbox ${isOver ? 'drop-active' : ''}`}>
      <div className="inbox-header">
        <span className="material-symbols-outlined text-lg">inbox</span>
        <span className="font-headline">Inbox — Not Yet Placed</span>
        <span className="inbox-count">{items.length}</span>
      </div>
      <div className="inbox-items">
        {items.length > 0 ? (
          items.map((item) => (
            <DraggableItem key={item.id} item={item} onClick={onItemClick} />
          ))
        ) : (
          <span className="empty-hint">All items placed! 🎉</span>
        )}
      </div>
    </div>
  );
}