'use client';

import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RobeIcon } from './ZoneIcons';
import type { ClothingItem } from '@/hooks/queries/wardrobe';

export default function DraggableItem({
  item,
  onClick,
  overlay = false,
}: {
  item: ClothingItem;
  onClick?: (clothingItem: ClothingItem) => void;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { item, type: 'item' },
    disabled: overlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => onClick?.(item)}
      className={`shrink-0 w-20 cursor-grab active:cursor-grabbing ${overlay ? 'opacity-90' : ''} ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface-variant border border-outline-variant shadow-sm relative hover:shadow-md hover:border-primary/40 transition-all">
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
            <RobeIcon className="text-on-surface-variant" width={28} height={30} />
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-center text-on-surface truncate px-0.5 leading-tight">
        {item.name}
      </p>
    </div>
  );
}
