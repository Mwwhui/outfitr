'use client';

import Image from 'next/image';
import { useDraggable } from '@dnd-kit/core';
import { RobeIcon } from './ZoneIcons';
import type { ClothingItem } from '@/hooks/queries/wardrobe';

export default function DraggableItem({
  item,
  onClick,
  overlay = false,
}: {
  item: ClothingItem;
  onClick?: (item: ClothingItem) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
    disabled: overlay,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => onClick?.(item)}
      className={`shrink-0 w-20 cursor-grab active:cursor-grabbing ${overlay ? 'opacity-90' : ''}`}
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