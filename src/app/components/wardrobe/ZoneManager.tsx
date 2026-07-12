'use client';

import { useState, useEffect } from 'react';
import type { LocationZone } from '@/hooks/queries/locations';
import { getZoneIcon } from './ZoneIcons';
import ConfirmModal from '../ConfirmModal';

interface ZoneManagerProps {
  open: boolean;
  zones: LocationZone[];
  onClose: () => void;
  onCreate: (zone: { name: string; type: LocationZone['type']; color: string }) => void;
  onUpdate: (id: string, data: Partial<LocationZone>) => void;
  onDelete: (id: string) => void;
  onReorder: (zones: LocationZone[]) => void;
}

const ZONE_COLORS = [
  { name: 'Default', value: '#e3e2e2' },
  { name: 'Warm Sand', value: '#e8dcc8' },
  { name: 'Soft Sage', value: '#d4e4d1' },
  { name: 'Dusty Rose', value: '#e8d4d4' },
  { name: 'Sky Blue', value: '#d4e0e8' },
  { name: 'Lavender', value: '#e0d4e8' },
  { name: 'Peach', value: '#f0d8c4' },
];

const ZONE_TYPES: { value: LocationZone['type']; label: string }[] = [
  { value: 'shelf', label: 'Shelf' },
  { value: 'drawer', label: 'Drawer' },
  { value: 'hanging', label: 'Hanging Rod' },
  { value: 'other', label: 'Other' },
];

export default function ZoneManager({
  open,
  zones,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: ZoneManagerProps) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingZone, setEditingZone] = useState<LocationZone | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationZone['type']>('shelf');
  const [color, setColor] = useState('#e3e2e2');
  const [orderedZones, setOrderedZones] = useState<LocationZone[]>([]);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const deleteTarget = deleteZoneId ? zones.find((z) => z.id === deleteZoneId) : null;

  useEffect(() => {
    setOrderedZones(zones);
  }, [zones]);

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setType('shelf');
    setColor('#e3e2e2');
    setEditingZone(null);
    setDeleteZoneId(null);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), type, color });
    resetForm();
    setMode('list');
  };

  const handleUpdate = () => {
    if (!editingZone || !name.trim()) return;
    onUpdate(editingZone.id, { name: name.trim(), type, color });
    resetForm();
    setMode('list');
  };

  const startEdit = (zone: LocationZone) => {
    setEditingZone(zone);
    setName(zone.name);
    setType(zone.type);
    setColor(zone.color || '#e3e2e2');
    setMode('edit');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-surface-bright rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-outline-variant">
          {/* Header */}
          <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
            <h2 className="text-lg font-bold text-on-surface font-headline">
              {mode === 'list' && 'Manage Zones'}
              {mode === 'create' && 'Add Zone'}
              {mode === 'edit' && 'Edit Zone'}
            </h2>
            <button
              onClick={() => {
                if (mode === 'list') {
                  onClose();
                } else {
                  resetForm();
                  setMode('list');
                }
              }}
              className="p-1.5 hover:bg-surface-container rounded-lg transition"
            >
              <span className="material-symbols-outlined text-xl text-on-surface-variant">
                {mode === 'list' ? 'close' : 'arrow_back'}
              </span>
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
            {mode === 'list' && (
              <div className="space-y-2">
                {orderedZones.length === 0 && (
                  <p className="text-sm text-on-surface-variant text-center py-4">
                    No zones yet. Add your first zone to get started.
                  </p>
                )}
                {orderedZones.map((zone) => {
                  const Icon = getZoneIcon(zone.type);
                  return (
                    <div
                      key={zone.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition"
                    >
                      <Icon style={{ color: zone.color || '#e3e2e2' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {zone.name}
                        </p>
                        <p className="text-[11px] text-on-surface-variant capitalize">
                          {zone.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {orderedZones.length > 1 && (
                          <>
                            <button
                              onClick={() => {
                                const idx = orderedZones.findIndex((z) => z.id === zone.id);
                                if (idx <= 0) return;
                                const reordered = [...orderedZones];
                                const tmp = reordered[idx].display_order;
                                reordered[idx] = { ...reordered[idx], display_order: reordered[idx - 1].display_order };
                                reordered[idx - 1] = { ...reordered[idx - 1], display_order: tmp };
                                [reordered[idx], reordered[idx - 1]] = [reordered[idx - 1], reordered[idx]];
                                setOrderedZones(reordered);
                                onReorder(reordered);
                              }}
                              className="p-1 hover:bg-surface-container-high rounded-lg transition"
                              title="Move up"
                            >
                              <span className="material-symbols-outlined text-base text-on-surface-variant">
                                arrow_upward
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                const idx = orderedZones.findIndex((z) => z.id === zone.id);
                                if (idx < 0 || idx >= orderedZones.length - 1) return;
                                const reordered = [...orderedZones];
                                const tmp = reordered[idx].display_order;
                                reordered[idx] = { ...reordered[idx], display_order: reordered[idx + 1].display_order };
                                reordered[idx + 1] = { ...reordered[idx + 1], display_order: tmp };
                                [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
                                setOrderedZones(reordered);
                                onReorder(reordered);
                              }}
                              className="p-1 hover:bg-surface-container-high rounded-lg transition"
                              title="Move down"
                            >
                              <span className="material-symbols-outlined text-base text-on-surface-variant">
                                arrow_downward
                              </span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => startEdit(zone)}
                          className="p-1.5 hover:bg-surface-container-high rounded-lg transition"
                        >
                          <span className="material-symbols-outlined text-base text-on-surface-variant">
                            edit
                          </span>
                        </button>
                        <button
                          onClick={() => setDeleteZoneId(zone.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition"
                        >
                          <span className="material-symbols-outlined text-base text-error">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => setMode('create')}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-outline-variant rounded-xl text-sm font-medium text-on-surface-variant hover:border-primary hover:text-primary transition"
                >
                  <span className="material-symbols-outlined">add</span>
                  Add Zone
                </button>
              </div>
            )}

            {(mode === 'create' || mode === 'edit') && (
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                    Zone Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Main Closet, Drawer 2"
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                    Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ZONE_TYPES.map((t) => {
                      const Icon = getZoneIcon(t.value);
                      return (
                        <button
                          key={t.value}
                          onClick={() => setType(t.value)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition ${
                            type === t.value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-outline-variant text-on-surface hover:bg-surface-container'
                          }`}
                        >
                          <Icon style={{ color: type === t.value ? '#000000' : '#94a3b8' }} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ZONE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setColor(c.value)}
                        className={`w-8 h-8 rounded-full border-2 transition ${
                          color === c.value
                            ? 'border-primary scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      resetForm();
                      setMode('list');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface text-sm font-semibold hover:bg-surface-container-high transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={mode === 'create' ? handleCreate : handleUpdate}
                    disabled={!name.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
                  >
                    {mode === 'create' ? 'Create Zone' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!deleteZoneId}
        title={`Delete "${deleteTarget?.name || ''}"?`}
        message="Items in this zone will move to the Inbox."
        onConfirm={() => {
          if (deleteZoneId) onDelete(deleteZoneId);
          setDeleteZoneId(null);
        }}
        onCancel={() => setDeleteZoneId(null)}
      />
    </>
  );
}