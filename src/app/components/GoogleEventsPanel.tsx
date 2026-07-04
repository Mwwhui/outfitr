'use client';

import { useEffect, useState } from 'react';

type GCalEvent = {
  id: string;
  summary: string;
  location: string | null;
  start: string | null;
  end: string | null;
  allDay: boolean;
  htmlLink: string | null;
};

type Props = {
  date: string; // YYYY-MM-DD
  enabled: boolean;
  connected: boolean;
};

function formatTimeRange(start: string | null, end: string | null) {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;

  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return e ? `${fmt(s)}–${fmt(e)}` : fmt(s);
}

export default function GoogleEventsPanel({ date, enabled, connected }: Props) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If user turned off, or not connected, clear
    if (!enabled || !connected) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/integrations/google/events?date=${encodeURIComponent(date)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        setEvents(Array.isArray(j.events) ? j.events : []);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setEvents([]);
        setError('Failed to load Google events.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, enabled, connected]);

  if (!enabled) return null;

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm text-black">📅 Events</div>
        {!connected && (
          <span className="text-[10px] text-slate-400">Not connected</span>
        )}
      </div>

      {!connected ? (
        <p className="text-xs text-slate-400">
          Connect Google Calendar to see events here.
        </p>
      ) : loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-surface-variant" />
            <div className="h-3 bg-surface-variant rounded w-8" />
            <div className="h-3 bg-surface-variant rounded flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-surface-variant" />
            <div className="h-3 bg-surface-variant rounded w-10" />
            <div className="h-3 bg-surface-variant rounded flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-surface-variant" />
            <div className="h-3 bg-surface-variant rounded w-6" />
            <div className="h-3 bg-surface-variant rounded w-3/4" />
          </div>
        </div>
      ) : error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-slate-400">No events.</p>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <div key={ev.id} className="text-xs">
              {ev.htmlLink ? (
                <a
                  href={ev.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-slate-800 hover:text-black hover:underline"
                >
                  {ev.summary}
                </a>
              ) : (
                <div className="font-medium text-slate-800">{ev.summary}</div>
              )}
              <div className="text-slate-500">
                {ev.allDay ? 'All day' : formatTimeRange(ev.start, ev.end)}
                {ev.location ? ` • ${ev.location}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
