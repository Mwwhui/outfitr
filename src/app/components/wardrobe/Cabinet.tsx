'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import ReactGridLayout, { useContainerWidth, noCompactor, type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { ClosetLayoutItem } from '@/hooks/queries/locations';

interface CabinetProps {
  layout: ClosetLayoutItem[];
  onLayoutChange: (layout: ClosetLayoutItem[]) => void;
  editMode: boolean;
  children: React.ReactNode;
}

export default function Cabinet({
  layout,
  onLayoutChange,
  editMode,
  children,
}: CabinetProps) {
  const [width, setWidth] = useState(0);
  const { width: trackedWidth, containerRef: rglContainerRef } = useContainerWidth();
  const lastLayoutRef = useRef('');

  useEffect(() => {
    if (trackedWidth > 0) {
      setWidth(trackedWidth);
    }
  }, [trackedWidth]);

  const handleLayoutChange = useCallback((newLayout: readonly LayoutItem[]) => {
    const mapped: ClosetLayoutItem[] = newLayout.map((item) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }));
    const serialized = JSON.stringify(mapped);
    if (serialized !== lastLayoutRef.current) {
      lastLayoutRef.current = serialized;
      onLayoutChange(mapped);
    }
  }, [onLayoutChange]);

  if (width === 0) {
    return <div ref={rglContainerRef} className="cabinet-frame" style={{ minHeight: 300 }} />;
  }

  return (
    <div ref={rglContainerRef} className="cabinet-frame">
      <div className={`cabinet-body ${editMode ? 'editing' : ''}`}>
        <ReactGridLayout
          width={width}
          layout={layout as unknown as LayoutItem[]}
          onLayoutChange={editMode ? handleLayoutChange : undefined}
          gridConfig={{
            cols: 12,
            rowHeight: 30,
            margin: [8, 8] as readonly [number, number],
            containerPadding: [12, 12] as readonly [number, number],
            maxRows: Infinity,
          }}
          dragConfig={{
            enabled: editMode,
            bounded: true,
            handle: '.drag-handle',
            threshold: 5,
          }}
          resizeConfig={{
            enabled: editMode,
            handles: ['se'],
          }}
          compactor={noCompactor}
          autoSize
        >
          {children}
        </ReactGridLayout>
      </div>
    </div>
  );
}