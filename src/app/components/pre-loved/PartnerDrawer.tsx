import { Partner } from './PartnerDirectory';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
}

export default function PartnerDrawer({ isOpen, onClose, partner }: Props) {
  const badgeLabels: Record<string, string> = {
    donate: 'Donate',
    sell: 'Sell / Trade',
    recycle: 'Recycle',
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
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
            {[
              {
                name: 'Vintage Denim Jacket',
                brand: "Levi's",
                material: '100% Cotton',
                impact: 'High Impact',
              },
              {
                name: 'Chunky Cable Knit',
                brand: 'Unbranded',
                material: 'Wool Blend',
                impact: 'Medium Impact',
              },
              {
                name: 'Floral Midi Dress',
                brand: 'Zara',
                material: 'Polyester',
                impact: 'Low Impact',
              },
            ].map((item, i) => (
              <label
                key={i}
                className="flex gap-4 p-4 border border-gray-200 rounded-2xl cursor-pointer hover:border-[#163422] bg-white transition-colors has-[:checked]:border-[#163422] has-[:checked]:bg-green-50"
              >
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center text-2xl">
                  👕
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <p className="font-semibold text-[#163422] text-sm">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400 mb-1">
                    {item.brand} · {item.material}
                  </p>
                  <span className="text-xs text-green-700 font-medium">
                    🌱 {item.impact}
                  </span>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-gray-300 text-[#163422] focus:ring-[#163422] cursor-pointer"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-white">
          <button className="w-full bg-[#163422] text-white py-4 rounded-xl text-sm font-bold hover:bg-[#2d4b37] transition-colors">
            Confirm &amp;{' '}
            {partner?.type === 'donate'
              ? 'Donate'
              : partner?.type === 'sell'
                ? 'List for Sale'
                : 'Schedule Pickup'}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            You&apos;ll receive a confirmation &amp; QR code by email.
          </p>
        </div>
      </div>
    </>
  );
}
