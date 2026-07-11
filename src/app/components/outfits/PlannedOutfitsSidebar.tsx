'use client';

import { useRouter } from 'next/navigation';

interface PlanSlot {
  id: string;
  name: string;
  type?: string;
  color?: string;
  image_url?: string;
}

interface Plan {
  id: string;
  date: string;
  time_slot: string;
  slots: Record<string, PlanSlot>;
  name: string | null;
}

interface PlannedOutfitsSidebarProps {
  plans: Plan[];
  weather: { temp: number; description: string; icon: string } | null;
  onSwap: (planId: string, date: string) => void;
  onPlan: (date: string) => void;
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[date.getDay()];
}

function getDayNumber(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDate().toString();
}

function formatItems(slots: Record<string, PlanSlot>): string {
  const items = Object.values(slots).filter(Boolean);
  if (items.length === 0) return 'No items';
  const names = items.map(s => s.name).filter(Boolean);
  if (names.length <= 2) return names.join(' + ');
  return `${names[0]} + ${names.length - 1} more`;
}

function getWeatherTip(weather: { temp: number; description: string }): string {
  if (weather.temp < 10) {
    return "It's chilly today. Consider adding a layer — swap light tops for warmer knits or add outerwear.";
  }
  if (weather.temp > 28) {
    return "It's hot today. Breathable fabrics and light colors work best — keep layers minimal.";
  }
  if (weather.description.toLowerCase().includes('rain')) {
    return "Rain expected — water-resistant fabrics and closed shoes are recommended today.";
  }
  return "Your wardrobe is ready for today's conditions. Mix and match with confidence.";
}

export default function PlannedOutfitsSidebar({
  plans,
  weather,
  onSwap,
  onPlan,
}: PlannedOutfitsSidebarProps) {
  const router = useRouter();

  // Generate next 8 days from today (i=0..7 covers plans scheduled for today+7 via getNextWeekday)
  const days: { date: string; plan?: Plan }[] = [];
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const plan = plans.find(p => p.date === dateStr);
    days.push({ date: dateStr, plan });
  }

  return (
    <div className="bg-surface-bright border border-outline-variant rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-bold text-on-surface font-headline">Planned Outfits</h3>
        <button
          onClick={() => router.push('/calendar')}
          className="text-xs text-on-surface-variant hover:text-primary transition-colors font-semibold"
        >
          View All
        </button>
      </div>

      {/* Day rows */}
      <div className="space-y-4">
        {days.map(({ date, plan }) => {
          const dayLabel = getDayLabel(date);
          const dayNum = getDayNumber(date);

          if (plan) {
            return (
              <div key={date} className="flex items-start gap-3">
                <div className="shrink-0 w-10">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{dayLabel}</p>
                  <p className="text-sm font-black text-on-surface">{dayNum}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {plan.name || formatItems(plan.slots)}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate mt-0.5">
                    {formatItems(plan.slots)}
                  </p>
                </div>
                <button
                  onClick={() => onSwap(plan.id, date)}
                  className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary bg-surface-container-high px-2 py-1 rounded hover:bg-primary hover:text-on-primary transition-colors"
                >
                  Quick Swap
                </button>
              </div>
            );
          }

          return (
            <div key={date} className="flex items-center gap-3">
              <div className="shrink-0 w-10">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{dayLabel}</p>
                <p className="text-sm font-black text-on-surface">{dayNum}</p>
              </div>
              <button
                onClick={() => onPlan(date)}
                className="flex-1 text-sm text-primary border border-outline-variant rounded-lg py-2 flex items-center justify-center gap-1 hover:bg-primary hover:text-on-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Plan Outfit
              </button>
            </div>
          );
        })}
      </div>

      {/* Style Tip — only when weather data available */}
      {weather && (
        <div className="mt-6 pt-4 border-t border-outline-variant">
          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-on-surface-variant text-sm">lightbulb</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Style Tip</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {getWeatherTip(weather)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
