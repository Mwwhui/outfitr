import { useState } from 'react';
import { Partner } from './PartnerDirectory';

export interface ClothesItem {
  id: string;
  name: string;
  brand: string | null;
  material: string | null;
  image_url: string | null;
  unused?: boolean;
  [key: string]: unknown;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
  items: ClothesItem[];
  loading: boolean;
}

export default function PartnerDrawer({ isOpen, onClose, partner, items, loading }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const badgeLabels: Record<string, string> = {
    donate: 'Donate',
    sell: 'Sell / Trade',
    recycle: 'Recycle',
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
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
            <h3 className="text-xl font-bold text-[#163422]">Select Items</h3>
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
                <div className="w-8 h-8 border-2 border-[#163422] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm">Loading your wardrobe...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">👕</div>
                <p className="text-sm mb-1">Your wardrobe is empty</p>
                <p className="text-xs">Add some items first to pledge them here.</p>
              </div>
            ) : (
              items.map((item) => (
                <label
                  key={item.id}
                  className="flex gap-4 p-4 border border-gray-200 rounded-2xl cursor-pointer hover:border-[#163422] bg-white transition-colors has-[:checked]:border-[#163422] has-[:checked]:bg-green-50"
                >
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center text-2xl overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>👕</span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <p className="font-semibold text-[#163422] text-sm truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400 mb-1 truncate">
                      {item.brand || '\u2014'} · {item.material || '\u2014'}
                    </p>
                    {item.unused ? (
                      <span className="text-xs text-green-700 font-medium">
                        🌱 Unused
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="w-5 h-5 rounded border-gray-300 text-[#163422] focus:ring-[#163422] cursor-pointer"
                    />
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-white">
          <button
            disabled={selectedIds.length === 0}
            className={`w-full py-4 rounded-xl text-sm font-bold transition-colors ${
              selectedIds.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#163422] text-white hover:bg-[#2d4b37]'
            }`}
          >
            Confirm &amp;{' '}
            {partner?.type === 'donate'
              ? 'Donate'
              : partner?.type === 'sell'
                ? 'List for Sale'
                : 'Schedule Pickup'}
            {selectedIds.length > 0 && ` (${selectedIds.length})`}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            You&apos;ll receive a confirmation &amp; QR code by email.
          </p>
        </div>
      </div>
    </>
  );
}
