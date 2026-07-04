'use client';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Partner } from './PartnerDirectory';
import { ScoredItem, DisposalMethod } from '@/lib/disposalRecommender';

export interface ClothesItem {
  id: string;
  name: string;
  brand: string | null;
  material: string | null;
  image_url: string | null;
  unused?: boolean;
  [key: string]: unknown;
}

const BADGE_LABELS_METHOD: Record<DisposalMethod, string> = {
  donate: 'Best to donate',
  sell: 'Best to sell',
  recycle: 'Best to recycle',
};

const METHOD_COLORS: Record<DisposalMethod, string> = {
  donate: 'bg-amber-100 text-amber-800',
  sell: 'bg-blue-100 text-blue-800',
  recycle: 'bg-green-100 text-green-800',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
  items: ClothesItem[];
  loading: boolean;
  onConfirm: (
    itemIds: string[],
    partnerId: string,
    actionType: string,
  ) => Promise<void>;
  recommendations?: Record<string, ScoredItem>;
}

export default function PartnerDrawer({
  isOpen,
  onClose,
  partner,
  items,
  loading,
  onConfirm,
  recommendations,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const badgeLabels: Record<string, string> = {
    donate: 'Donate',
    sell: 'Sell / Trade',
    recycle: 'Recycle',
  };

  const sortedItems = useMemo(() => {
    if (!partner || !recommendations) return items;
    const method = partner.type as DisposalMethod;
    const copy = [...items];
    copy.sort((a, b) => {
      const recA = recommendations[a.id];
      const recB = recommendations[b.id];
      if (!recA || !recB) return 0;
      const aMatch = recA.method === method ? 1 : 0;
      const bMatch = recB.method === method ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return recB.scores[method] - recA.scores[method];
    });
    return copy;
  }, [items, partner, recommendations]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const getMismatchHint = (itemId: string): string | null => {
    if (!partner || !recommendations) return null;
    const rec = recommendations[itemId];
    if (!rec) return null;
    const method = partner.type as DisposalMethod;
    if (rec.method === method) return null;
    if (rec.scores[method] >= 40) return null;
    return `Better suited for ${BADGE_LABELS_METHOD[rec.method].replace('Best to ', '')}`;
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 lg:left-auto lg:right-0 lg:w-[460px] lg:h-screen lg:top-0 bg-white rounded-t-3xl lg:rounded-none lg:rounded-l-3xl shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen
            ? 'translate-y-0 lg:translate-x-0'
            : 'translate-y-full lg:translate-x-full'
        }`}
        style={{ maxHeight: '90vh' }}
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl lg:rounded-tl-3xl">
          <div>
            <h3 className="text-xl font-bold text-[#0f172a]">Select Items</h3>
            {partner && (
              <p className="text-xs text-gray-500 mt-0.5">For {partner.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition text-lg"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-500 mb-5">
            Choose items from your wardrobe to pledge for{' '}
            {partner ? badgeLabels[partner.type].toLowerCase() : 'this action'}.
          </p>
          <div className="space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin mb-3" />
                <p className="text-sm">Loading your wardrobe...</p>
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm mb-1">Your wardrobe is empty</p>
                <p className="text-xs">
                  Add some items first to pledge them here.
                </p>
              </div>
            ) : (
              sortedItems.map((item) => {
                const rec = recommendations?.[item.id];
                const isSelected = selectedIds.includes(item.id);
                const mismatchHint = isSelected
                  ? getMismatchHint(item.id)
                  : null;
                return (
                  <label
                    key={item.id}
                    className={`flex gap-4 p-4 border rounded-2xl cursor-pointer transition-colors has-[:checked]:border-[#0f172a] has-[:checked]:bg-gray-50 ${
                      rec && partner && rec.method === partner.type
                        ? 'border-gray-200 hover:border-[#0f172a] bg-white'
                        : 'border-gray-200 hover:border-gray-300 bg-white/80'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center text-2xl overflow-hidden relative">
                      {item.image_url ? (
                        <Image
                          fill
                          src={item.image_url}
                          alt={item.name}
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-gray-400 text-sm font-medium">
                          No img
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[#0f172a] text-sm truncate">
                          {item.name}
                        </p>
                        {rec && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide shrink-0 ${METHOD_COLORS[rec.method]}`}
                          >
                            {BADGE_LABELS_METHOD[rec.method]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mb-1 truncate">
                        {item.brand || '\u2014'} · {item.material || '\u2014'}
                      </p>
                      {item.unused ? (
                        <span className="text-xs text-gray-500 font-medium">
                          Unused
                        </span>
                      ) : null}
                      {mismatchHint && (
                        <p className="text-[11px] text-amber-600 mt-1 font-medium">
                          💡 {mismatchHint}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(item.id)}
                        className="w-5 h-5 rounded border-gray-300 text-[#0f172a] focus:ring-[#0f172a] cursor-pointer"
                      />
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-white">
          <button
            disabled={selectedIds.length === 0 || submitting}
            onClick={async () => {
              if (!partner || submitting) return;
              setSubmitting(true);
              try {
                await onConfirm(selectedIds, partner.id, partner.type);
                setSelectedIds([]);
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            className={`w-full py-4 rounded-xl text-sm font-bold transition-colors ${
              selectedIds.length === 0 || submitting
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#0f172a] text-white hover:bg-[#1e293b]'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              <>
                Confirm &amp;{' '}
                {partner?.type === 'donate'
                  ? 'Donate'
                  : partner?.type === 'sell'
                    ? 'List for Sale'
                    : 'Schedule Pickup'}
                {selectedIds.length > 0 && ` (${selectedIds.length})`}
              </>
            )}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            You&apos;ll receive a confirmation &amp; QR code by email.
          </p>
        </div>
      </div>
    </>
  );
}
