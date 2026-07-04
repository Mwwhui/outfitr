'use client';

import Image from 'next/image';

interface OutfitItem {
  id: string;
  name: string;
  image_url: string | null;
  type?: string;
  color?: string | null;
}

interface Props {
  items: OutfitItem[];
  outfitName: string;
  description: string;
  weather?: { temp: number; condition: string; icon: string } | null;
  tags?: string[];
  onLogWear?: () => void;
  loggingWear?: boolean;
  title?: string;
  logWearLabel?: string;
  loggingLabel?: string;
}

export default function TodaysEnsemble({
  items,
  outfitName,
  description,
  weather,
  tags = [],
  onLogWear,
  loggingWear,
  logWearLabel = 'Log Wear',
  loggingLabel = 'Logging...',
}: Props) {
  const hasImages = items.some((i) => i.image_url);

  return (
    <div className="glass-card rounded-lg p-6 flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-1/2 aspect-[4/5] rounded bg-surface-variant overflow-hidden flex items-center justify-center relative">
        {hasImages ? (
          items.length === 1 ? (
            <Image
              fill
              src={items[0].image_url!}
              alt={items[0].name}
              className="object-cover"
            />
          ) : (
            <div className="grid grid-cols-2 gap-1 w-full h-full">
              {items.slice(0, 4).map((item, i) => (
                <div
                  key={item.id || i}
                  className="relative overflow-hidden bg-surface-variant"
                >
                  {item.image_url ? (
                    <Image
                      fill
                      src={item.image_url}
                      alt={item.name}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant">
                        checkroom
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">
            checkroom
          </span>
        )}
      </div>
      <div className="w-full md:w-1/2 flex flex-col justify-between">
        <div>
          {weather && (
            <div className="flex items-center gap-1 text-on-surface-variant mb-3">
              <span className="material-symbols-outlined text-sm">
                {weather.icon}
              </span>
              <span className="text-sm font-semibold">
                {weather.temp}&deg;F &bull; {weather.condition}
              </span>
            </div>
          )}
          <h4 className="text-2xl font-semibold text-on-surface mb-3">
            {outfitName}
          </h4>
          <p className="text-base text-on-surface-variant mb-4">
            {description}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-surface-container-low text-primary border border-surface-variant rounded-full text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onLogWear}
          disabled={loggingWear || !onLogWear}
          className="w-full py-3 bg-surface-container text-primary font-semibold rounded border border-outline-variant hover:bg-surface-variant transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loggingWear ? (
            <>
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              {loggingLabel}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">check</span>
              {logWearLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
