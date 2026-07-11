'use client';

import Image from 'next/image';

interface PairingItem {
  name: string;
  type: string;
  image_url: string | null;
  color: string | null;
}

interface OutfitMultiplierCardProps {
  multiplier: number;
  pairings: PairingItem[];
}

export default function OutfitMultiplierCard({
  multiplier,
  pairings,
}: OutfitMultiplierCardProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-2xl text-primary">
          auto_awesome
        </span>
        <div>
          <p className="text-lg font-black text-on-surface">
            Unlocks{' '}
            <span className="text-primary">{multiplier} new looks</span>
          </p>
          <p className="text-xs text-on-surface-variant">
            New outfit combinations with your existing wardrobe
          </p>
        </div>
      </div>
      {pairings.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Would go well with
          </p>
          <div className="grid grid-cols-2 gap-2">
            {pairings.map((pairing, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-surface-variant rounded-lg p-2"
              >
                <div className="w-10 h-10 rounded-md bg-surface-container-high overflow-hidden shrink-0 flex items-center justify-center">
                  {pairing.image_url ? (
                    <Image
                      src={pairing.image_url}
                      alt={pairing.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span
                      className="w-5 h-5 rounded-full"
                      style={{
                        backgroundColor: pairing.color || '#e3e2e2',
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface truncate">
                    {pairing.name}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">
                    {pairing.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
