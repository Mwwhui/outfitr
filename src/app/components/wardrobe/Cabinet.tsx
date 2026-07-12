'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
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
  const lastWidthRef = useRef(0);

  // Width fluctuation guard: ignore changes smaller than 10px
  // This filters out scrollbar appear/disappear jitter
  useEffect(() => {
    if (trackedWidth > 0) {
      const diff = Math.abs(trackedWidth - lastWidthRef.current);
      if (diff > 10 || lastWidthRef.current === 0) {
        lastWidthRef.current = trackedWidth;
        setWidth(trackedWidth);
      }
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

  // Compute grid height manually to prevent autoSize resize cascades
  const gridHeight = useMemo(() => {
    if (!layout || layout.length === 0) return 300;
    const maxRows = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    const rowHeight = 30;
    const marginY = 8;
    const paddingY = 12;
    return maxRows * rowHeight + Math.max(0, maxRows - 1) * marginY + 2 * paddingY;
  }, [layout]);

  // Memoize inline config objects so RGL doesn't re-process on every render
  const gridConfig = useMemo(
    () => ({
      cols: 12,
      rowHeight: 30,
      margin: [8, 8] as readonly [number, number],
      containerPadding: [12, 12] as readonly [number, number],
      maxRows: Infinity,
    }),
    []
  );

  const dragConfig = useMemo(
    () => ({
      enabled: editMode,
      bounded: true,
      handle: '.drag-handle',
      threshold: 5,
    }),
    [editMode]
  );

  const resizeConfig = useMemo(
    () => ({
      enabled: editMode,
      handles: ['se'] as const,
    }),
    [editMode]
  );

  const containerStyle = useMemo(
    () => ({ height: gridHeight }),
    [gridHeight]
  );

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
          gridConfig={gridConfig}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          compactor={noCompactor}
          style={containerStyle}
        >
          {children}
        </ReactGridLayout>
      </div>
    </div>
  );
}
