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
  isLogged?: boolean;
  loggedSlot?: 'day' | 'night' | null;
  nextSlotLabel?: string | null;
  canGoBack?: boolean;
  onGetNext?: () => void;
  onBackToLogged?: () => void;
  loadingNext?: boolean;
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
  isLogged = false,
  loggedSlot,
  nextSlotLabel,
  canGoBack = false,
  onGetNext,
  onBackToLogged,
  loadingNext = false,
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
          {isLogged && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full mb-2">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              Logged for {loggedSlot === 'day' ? 'Day' : 'Night'}
            </span>
          )}
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
        {isLogged ? (
          <div className="space-y-2">
            <button
              disabled
              className="w-full py-3 bg-green-100 text-green-700 font-semibold rounded border border-green-200 flex items-center justify-center gap-2 cursor-default"
            >
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Logged for {loggedSlot === 'day' ? 'Day' : 'Night'}
            </button>
            {nextSlotLabel && onGetNext && (
              <button
                onClick={onGetNext}
                disabled={loadingNext}
                className="w-full py-2 text-sm font-medium text-primary hover:underline flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {loadingNext ? (
                  <>
                    <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Get {nextSlotLabel === 'night' ? 'night' : 'day'} suggestion
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
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
            {canGoBack && onBackToLogged && (
              <button
                onClick={onBackToLogged}
                className="w-full py-2 text-sm font-medium text-primary hover:underline flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back to {loggedSlot === 'day' ? 'day' : 'night'} outfit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
