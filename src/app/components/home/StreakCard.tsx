'use client';

interface Props {
  currentStreak: number;
}

export default function StreakCard({ currentStreak }: Props) {
  const color =
    currentStreak >= 14
      ? '#ea580c'
      : currentStreak >= 7
        ? '#f97316'
        : currentStreak >= 3
          ? '#fb923c'
          : currentStreak >= 1
            ? '#fbbf24'
            : '#d1d5db';

  const active = currentStreak >= 3;

  return (
    <div className="flex flex-col items-end shrink-0">
      <div className="flex items-baseline gap-2 leading-none">
        <span
          className="material-symbols-outlined select-none"
          style={{
            fontSize: '2.35rem',
            paddingRight: '0.1rem',
            color,
            animation: active
              ? 'flame-flicker 1.8s ease-in-out infinite'
              : 'none',
            filter:
              currentStreak >= 14
                ? 'drop-shadow(0 0 8px rgba(234,88,12,0.4))'
                : 'none',
          }}
        >
          local_fire_department
        </span>
        <span
          className="text-6xl lg:text-7xl font-extrabold tracking-tighter leading-none"
          style={{ color }}
        >
          {currentStreak}
        </span>
        <span
          className={`text-sm font-medium leading-none ${currentStreak > 0 ? 'text-gray-400' : 'text-gray-300'}`}
        >
          {currentStreak === 1 ? 'day' : 'days'}
        </span>
      </div>
      {currentStreak === 0 && (
        <span className="text-xs text-gray-300 font-medium mt-1.5">
          no streak yet
        </span>
      )}

      <style>{`
        @keyframes flame-flicker {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          25% { transform: scale(1.1) rotate(-3deg); opacity: 0.85; }
          50% { transform: scale(1.15) rotate(2deg); opacity: 1; }
          75% { transform: scale(1.05) rotate(-1deg); opacity: 0.92; }
        }
      `}</style>
    </div>
  );
}
