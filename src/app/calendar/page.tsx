'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Loader from '../components/Loader';
import GoogleCalendarConnectCard from '../components/GoogleCalendarConnectCard';
import GoogleEventsPanel from '../components/GoogleEventsPanel';
import ConfirmModal from '../components/ConfirmModal';

type TimeSlot = 'day' | 'night';

type OutfitPlanRow = {
  id?: string;
  date: string; // "YYYY-MM-DD"
  time_slot: TimeSlot;
  slots: Record<string, any>; // saved JSONB
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// Monday-first calendar
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function safeSlotName(v: any) {
  if (!v) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.name || v.id || '—';
  return String(v);
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<OutfitPlanRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    toISODate(new Date()),
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  const [googleConnected, setGoogleConnected] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/integrations/google/status')
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then((j) => setGoogleConnected(Boolean(j.connected)))
      .catch(() => setGoogleConnected(false));
  }, [status]);

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
  }, [status, router]);

  // Fetch plans for the current month range
  useEffect(() => {
    async function loadMonthPlans() {
      if (status !== 'authenticated') return;

      setLoading(true);
      try {
        // Build range: from grid start to grid end so badges always show
        const first = startOfMonth(viewMonth);
        const last = endOfMonth(viewMonth);

        const gridStart = new Date(first);
        gridStart.setDate(first.getDate() - mondayIndex(first.getDay()));

        const gridEnd = new Date(last);
        gridEnd.setDate(last.getDate() + (6 - mondayIndex(last.getDay())));

        const from = toISODate(gridStart);
        const to = toISODate(gridEnd);

        const res = await fetch(`/api/outfit_plans?from=${from}&to=${to}`);
        if (!res.ok) {
          console.error('Failed to load outfit plans:', await res.text());
          setPlans([]);
          return;
        }
        const data = await res.json();
        setPlans(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Error loading outfit plans:', e);
        setPlans([]);
      } finally {
        setLoading(false);
      }
    }

    loadMonthPlans();
  }, [viewMonth, status]);

  const planMap = useMemo(() => {
    const m = new Map<string, { day?: OutfitPlanRow; night?: OutfitPlanRow }>();
    for (const p of plans) {
      const key = p.date;
      if (!m.has(key)) m.set(key, {});
      const entry = m.get(key)!;
      if (p.time_slot === 'day') entry.day = p;
      if (p.time_slot === 'night') entry.night = p;
    }
    return m;
  }, [plans]);

  const gridDays = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const last = endOfMonth(viewMonth);

    const start = new Date(first);
    start.setDate(first.getDate() - mondayIndex(first.getDay()));

    const end = new Date(last);
    end.setDate(last.getDate() + (6 - mondayIndex(last.getDay())));

    const days: Date[] = [];
    const cur = new Date(start);

    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [viewMonth]);

  const selectedPlans = useMemo(() => {
    return planMap.get(selectedDate) || {};
  }, [planMap, selectedDate]);

  const goPlanner = (date: string, timeSlot: TimeSlot) => {
    router.push(
      `/planner?date=${encodeURIComponent(date)}&timeSlot=${encodeURIComponent(
        timeSlot,
      )}`,
    );
  };

  const handleDeletePlan = async (planId: string) => {
    setDeletingPlanId(planId);
    try {
      const res = await fetch(`/api/outfit_plans/${planId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      toast.success('Outfit deleted');
    } catch (e) {
      console.error('Delete outfit plan failed:', e);
      toast.error('Failed to delete outfit');
    } finally {
      setDeletingPlanId(null);
      setConfirmDeleteId(null);
    }
  };

  if (status === 'loading') {
    return <Loader message="Loading session..." />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#163422]">Calendar</h1>

          <div className="flex gap-6 border-b border-slate-200">
          <button
            onClick={() => router.push('/wardrobe')}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === '/wardrobe'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            {/* Closet Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="4" y="3" width="16" height="18" rx="1.5" />
              <line x1="12" y1="3" x2="12" y2="21" />
              <circle cx="9" cy="12" r="0.6" />
              <circle cx="15" cy="12" r="0.6" />
            </svg>
            Wardrobe
          </button>

          <button
            onClick={() => router.push('/planner')}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === '/planner'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            {/* Pencil Note Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="4" y="4" width="11" height="16" rx="1.4" />
              <line x1="7" y1="8" x2="13" y2="8" />
              <line x1="7" y1="11" x2="12" y2="11" />
              <path d="M15.5 9.5l3.2-3.2a1.4 1.4 0 0 1 2 2l-3.2 3.2-2.4.4.4-2.4z" />
            </svg>
            Plan Outfit
          </button>

          <button
            onClick={() => router.push('/calendar')}
            className={`text-sm flex items-center gap-2 -mb-[1px] ${
              pathname === '/calendar'
                ? 'border-b-2 border-black font-semibold text-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            {/* Calendar Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <rect x="3.5" y="5" width="17" height="15" rx="2" />
              <line x1="3.5" y1="9" x2="20.5" y2="9" />
              <line x1="9" y1="3" x2="9" y2="7" />
              <line x1="15" y1="3" x2="15" y2="7" />
              <circle cx="9" cy="13" r="0.7" />
              <circle cx="15" cy="13" r="0.7" />
              <circle cx="9" cy="17" r="0.7" />
              <circle cx="15" cy="17" r="0.7" />
            </svg>
            Calendar
          </button>
        </div>
      </div>
    </div>

    <div className="px-6 pb-16 max-w-7xl mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] gap-6">
        {/* CALENDAR CARD */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          {/* Month controls */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
              className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              ←
            </button>

            <div className="text-base font-semibold text-black">
              {monthLabel(viewMonth)}
            </div>

            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              →
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
              <div
                key={w}
                className="text-xs font-semibold text-slate-500 px-2 py-1"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="py-10">
              <Loader message="Loading outfits..." />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {gridDays.map((d) => {
                const iso = toISODate(d);
                const inMonth = d.getMonth() === viewMonth.getMonth();
                const isSelected = iso === selectedDate;
                const entry = planMap.get(iso);
                const hasDay = !!entry?.day;
                const hasNight = !!entry?.night;

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => {
                      setSelectedDate(iso);
                      setPanelOpen(true);
                    }}
                    className={[
                      'rounded-xl border text-left p-2 min-h-[72px] transition',
                      isSelected
                        ? 'border-black bg-slate-50'
                        : 'border-slate-200 hover:bg-slate-50',
                      inMonth ? 'bg-white' : 'bg-slate-50',
                    ].join(' ')}
                    title={iso}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={[
                          'text-sm font-semibold',
                          inMonth ? 'text-black' : 'text-slate-400',
                        ].join(' ')}
                      >
                        {d.getDate()}
                      </div>

                      {(hasDay || hasNight) && (
                        <div className="text-[10px] text-slate-400">
                          {hasDay && hasNight ? '2' : '1'}
                        </div>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="mt-2 flex flex-col gap-1">
                      {hasDay && (
                        <span className="inline-flex w-fit items-center rounded-md bg-amber-50 text-amber-700 border border-amber-200 px-2 py-[2px] text-[10px]">
                          ☀ Day
                        </span>
                      )}
                      {hasNight && (
                        <span className="inline-flex w-fit items-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-[2px] text-[10px]">
                          🌙 Night
                        </span>
                      )}
                      {!hasDay && !hasNight && (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* SIDE PANEL */}
        <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          {/* Google Calendar connect + toggle */}
          <GoogleCalendarConnectCard
            connected={googleConnected}
            enabled={showGoogleEvents}
            onToggle={setShowGoogleEvents}
          />

          {/* Selected date header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Selected date</p>
              <p className="text-base font-semibold text-black">
                {selectedDate}
              </p>
            </div>
          </div>

          {panelOpen && (
            <div className="space-y-4">
              {/* DAY */}
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm text-black">
                    ☀ Day outfit
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedPlans.day?.id && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(selectedPlans.day!.id!)}
                        className="text-xs p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        title="Delete outfit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => goPlanner(selectedDate, 'day')}
                      className="text-xs px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
                    >
                      {selectedPlans.day ? 'Edit' : 'Plan'}
                    </button>
                  </div>
                </div>

                {selectedPlans.day ? (
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>Top: {safeSlotName(selectedPlans.day.slots?.top)}</div>
                    <div>
                      Bottom: {safeSlotName(selectedPlans.day.slots?.bottom)}
                    </div>
                    <div>
                      Outerwear:{' '}
                      {safeSlotName(selectedPlans.day.slots?.outerwear)}
                    </div>
                    <div>
                      One-Piece:{' '}
                      {safeSlotName(selectedPlans.day.slots?.onepiece)}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No day outfit saved.</p>
                )}
              </div>

              {/* NIGHT */}
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm text-black">
                    🌙 Night outfit
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedPlans.night?.id && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(selectedPlans.night!.id!)}
                        className="text-xs p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        title="Delete outfit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => goPlanner(selectedDate, 'night')}
                      className="text-xs px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
                    >
                      {selectedPlans.night ? 'Edit' : 'Plan'}
                    </button>
                  </div>
                </div>

                {selectedPlans.night ? (
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>
                      Top: {safeSlotName(selectedPlans.night.slots?.top)}
                    </div>
                    <div>
                      Bottom: {safeSlotName(selectedPlans.night.slots?.bottom)}
                    </div>
                    <div>
                      Outerwear:{' '}
                      {safeSlotName(selectedPlans.night.slots?.outerwear)}
                    </div>
                    <div>
                      One-Piece:{' '}
                      {safeSlotName(selectedPlans.night.slots?.onepiece)}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    No night outfit saved.
                  </p>
                )}
              </div>

              {/* GOOGLE EVENTS PANEL */}
              <GoogleEventsPanel
                date={selectedDate}
                enabled={showGoogleEvents}
                connected={googleConnected}
              />

              {/* Planner CTA */}
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/planner?date=${encodeURIComponent(
                      selectedDate,
                    )}&timeSlot=day`,
                  )
                }
                className="w-full rounded-xl bg-black text-white py-2 text-sm hover:bg-slate-800 transition"
              >
                Open Planner for this date
              </button>
            </div>
          )}
        </aside>

        <ConfirmModal
          open={confirmDeleteId !== null}
          title="Delete outfit?"
          message="This will remove the outfit plan and its wear logs. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => confirmDeleteId && handleDeletePlan(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
          loading={deletingPlanId !== null}
        />
      </div>
    </div>
    </div>
  );
}
