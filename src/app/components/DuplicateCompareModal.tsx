'use client';
import Image from 'next/image';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useBatchUpdateStatus } from '@/hooks/mutations/clothing';

interface ClusterItem {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
  wear_count: number;
  price: number;
  status?: string | null;
}

export interface DuplicateGroup {
  type: string;
  color: string;
  items: ClusterItem[];
}

interface Props {
  open: boolean;
  group: DuplicateGroup | null;
  onClose: () => void;
  userId?: string;
}

const COLOR_MAP: Record<string, string> = {
  black: '#1e293b',
  white: '#f8fafc',
  grey: '#94a3b8',
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  brown: '#a16207',
  pink: '#ec4899',
  purple: '#a855f7',
  orange: '#f97316',
  yellow: '#eab308',
};

export default function DuplicateCompareModal({
  open,
  group,
  onClose,
  userId,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const batchUpdate = useBatchUpdateStatus(userId);

  if (!open || !group) return null;

  const toggleSelect = (id: string) => {
    const item = group.items.find((i) => i.id === id);
    if (item?.status === 'pending_action') return; // Can't select pending items
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setShowConfirm(true);
  };

  // Only non-pending items can be kept or deleted
  const actionableItems = group.items.filter(
    (i) => i.status !== 'pending_action',
  );
  const pendingItems = group.items.filter((i) => i.status === 'pending_action');
  const keepItems = actionableItems.filter((i) => selectedIds.has(i.id));
  const deleteItems = actionableItems.filter((i) => !selectedIds.has(i.id));
  const deleteIds = deleteItems.map((i) => i.id);

  const handleCancel = () => {
    setSelectedIds(new Set());
    setShowConfirm(false);
  };

  const handleConfirm = async () => {
    if (keepItems.length === 0 || deleteIds.length === 0) return;
    setDeleting(true);

    try {
      const { succeeded, failed } = await batchUpdate.mutateAsync({
        ids: deleteIds,
        status: 'pending_action',
      });

      if (failed > 0) {
        toast.error(`Failed to move ${failed} item${failed > 1 ? 's' : ''}`);
      } else {
        const keptNames = keepItems.map((i) => i.name).join(', ');
        toast.success(
          `Kept ${keptNames}. ${deleteIds.length} item${deleteIds.length > 1 ? 's' : ''} moved to Pre-Loved.`,
          { duration: 5000 },
        );
        // Undo toast
        toast(
          (t) => (
            <button
              onClick={async () => {
                await batchUpdate.mutateAsync({
                  ids: deleteIds,
                  status: null,
                });
                toast.dismiss(t.id);
                toast.success('Items restored to wardrobe');
              }}
              className="text-sm font-semibold underline"
            >
              Undo
            </button>
          ),
          { duration: 5000 },
        );
      }

      // Reset and close
      setSelectedIds(new Set());
      setShowConfirm(false);
      onClose();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setDeleting(false);
    }
  };

  const colorHex = COLOR_MAP[group.color] || '#cbd5e1';
  const hasSelection = selectedIds.size > 0;
  const maxWear = Math.max(...group.items.map((i) => i.wear_count));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ backgroundColor: colorHex }}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 capitalize">
              {group.color} {group.type}
            </h2>
            <p className="text-xs text-slate-400">
              {pendingItems.length > 0 && (
                <span className="text-amber-500 font-medium">
                  {pendingItems.length} already flagged ·{' '}
                </span>
              )}
              Tap items to keep — {actionableItems.length - selectedIds.size}{' '}
              will be moved to Pre-Loved
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {group.items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isPending = item.status === 'pending_action';
              return (
                <div
                  key={item.id}
                  className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-emerald-500 shadow-lg shadow-emerald-500/10'
                      : isPending
                        ? 'border-amber-200 opacity-60'
                        : 'border-transparent hover:border-slate-200'
                  }`}
                >
                  {/* Image */}
                  <div className="aspect-[3/4] bg-slate-100 relative">
                    {item.image_url ? (
                      <Image
                        fill
                        src={item.image_url}
                        alt={item.name}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="w-10 h-10 opacity-30"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}

                    {/* Pending badge */}
                    {isPending && (
                      <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm">
                        Pending in Pre-Loved
                      </div>
                    )}

                    {/* Selected checkmark overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            className="w-6 h-6 text-white"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Wear count badge */}
                    {!isPending &&
                      maxWear > 0 &&
                      item.wear_count === maxWear && (
                        <div className="absolute top-2 left-2 bg-emerald-500 text-white rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm flex items-center gap-1">
                          <span
                            className="material-symbols-outlined text-[11px] leading-none"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            local_fire_department
                          </span>
                          Most Worn
                        </div>
                      )}
                    {!isPending && item.wear_count === 0 && (
                      <div className="absolute top-2 left-2 bg-slate-100 text-slate-400 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm">
                        Never Worn
                      </div>
                    )}
                    {!isPending &&
                      maxWear > 0 &&
                      item.wear_count > 0 &&
                      item.wear_count < maxWear && (
                        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm">
                          Worn {item.wear_count}×
                        </div>
                      )}
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-white">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.price > 0 && (
                        <span className="text-xs text-slate-400">
                          RM{item.price}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Keep button */}
                  <button
                    onClick={() => toggleSelect(item.id)}
                    disabled={deleting || isPending}
                    className={`w-full py-2.5 text-xs font-semibold transition ${
                      isPending
                        ? 'bg-amber-50 text-amber-400 cursor-not-allowed'
                        : isSelected
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {isPending
                      ? 'Already flagged'
                      : isSelected
                        ? 'Keeping'
                        : 'Keep'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirmation bar */}
        <div
          className={`border-t border-slate-100 bg-white px-6 py-4 shrink-0 transition-all duration-300 ${
            showConfirm && hasSelection
              ? 'translate-y-0 opacity-100'
              : 'translate-y-full opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">
                Keeping {keepItems.length} item
                {keepItems.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-slate-400">
                {deleteIds.length} item{deleteIds.length !== 1 ? 's' : ''} will
                be moved to Pre-Loved
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCancel}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={deleting || deleteIds.length === 0}
                className="px-5 py-2 rounded-full bg-black text-white text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-60"
              >
                {deleting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Moving...
                  </span>
                ) : (
                  `Confirm & Move to Pre-Loved`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
