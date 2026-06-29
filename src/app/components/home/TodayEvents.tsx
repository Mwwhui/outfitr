'use client';

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface Props {
  events: CalendarEvent[];
  suggestedOccasion?: string;
}

const OCCASION_ICONS: Record<string, string> = {
  business: 'business_center',
  formal: 'celebration',
  sport: 'fitness_center',
  date: 'favorite',
  casual: 'coffee',
};

function formatTime(iso: string, allDay: boolean): string {
  if (allDay) return 'All day';
  const d = new Date(iso);
  return d.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' });
}

export default function TodayEvents({ events, suggestedOccasion }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="bg-surface-bright rounded-lg p-4 border border-outline-variant shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-sm">event</span>
          <span className="text-sm font-bold text-on-surface">Today&apos;s Events</span>
        </div>
        {suggestedOccasion && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">{OCCASION_ICONS[suggestedOccasion] || 'checkroom'}</span>
            {suggestedOccasion}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {events.slice(0, 3).map((ev) => (
          <div key={ev.id} className="flex items-center gap-3 text-sm">
            <span className="text-xs text-on-surface-variant font-medium w-16 shrink-0">
              {formatTime(ev.start, ev.allDay)}
            </span>
            <span className="text-on-surface truncate">{ev.summary}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
