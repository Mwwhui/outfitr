'use client';

import { useEffect, useState } from 'react';

interface Props {
  weather?: { temp: number; condition: string } | null;
  occasion?: string;
  score?: number;
  wearCount?: number;
  onDismiss: () => void;
}

export default function OutfitFeedback({ weather, occasion, score, wearCount, onDismiss }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  const messages: string[] = [];

  if (weather) {
    messages.push(`Perfect for ${weather.temp}°C and ${weather.condition.toLowerCase()}`);
  }
  if (occasion && occasion !== 'casual') {
    messages.push(`Great choice for ${occasion} attire`);
  }
  if (score && score >= 80) {
    messages.push(`This combo scores ${score}/100 for style`);
  }
  if (wearCount && wearCount > 10) {
    messages.push(`You&apos;ve worn this ${wearCount} times — excellent value!`);
  }

  if (messages.length === 0) {
    messages.push('Outfit logged! Looking great today.');
  }

  const primaryMessage = messages[0];
  const secondaryMessage = messages.length > 1 ? messages[1] : null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-surface-bright border border-outline-variant shadow-lg rounded-xl px-6 py-4 flex items-start gap-3 max-w-md">
        <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">check_circle</span>
        <div>
          <p className="text-sm font-semibold text-on-surface">{primaryMessage}</p>
          {secondaryMessage && (
            <p className="text-xs text-on-surface-variant mt-1">{secondaryMessage}</p>
          )}
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
          className="material-symbols-outlined text-on-surface-variant text-lg hover:text-on-surface shrink-0"
        >
          close
        </button>
      </div>
    </div>
  );
}
