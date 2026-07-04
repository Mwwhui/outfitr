'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  useOutfitPlans,
  useGoogleStatus,
  type OutfitPlanRow,
} from '@/hooks/queries/calendar';
import Loader from '../components/Loader';
import GoogleCalendarConnectCard from '../components/GoogleCalendarConnectCard';
import GoogleEventsPanel from '../components/GoogleEventsPanel';
import ConfirmModal from '../components/ConfirmModal';

type TimeSlot = 'day' | 'night';

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

function TooltipSlotGroup({
  label,
  labelColor,
  slots,
}: {
  label: string;
  labelColor: string;
  slots: Record<string, any>;
}) {
  const items = Object.entries(slots || {}).filter(
    ([, v]) => v && typeof v === 'object' && 'id' in v,
  );
  if (!items.length) return null;
  return (
    <div>
      <p
        className={`text-[10px] font-semibold ${labelColor} uppercase tracking-wider mb-1.5`}
      >
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {items.map(([, item]) => (
          <div
            key={item.id}
            className="relative aspect-[3/4] rounded-lg overflow-hidden bg-slate-100"
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                No img
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-[2px] px-1.5 py-1">
              <p className="text-[10px] text-white text-center truncate leading-tight">
                {item.name}
              </p>
              {item.use_case && item.use_case.length > 0 && (
                <div className="flex flex-wrap gap-[2px] justify-center mt-[2px]">
                  {item.use_case.map((uc: ReactNode, index: number) => (
                    <span
                      key={index}
                      className="text-[7px] uppercase tracking-wider text-white/50 bg-white/10 rounded px-[3px]"
                    >
                      {uc}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const gridStart = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const gs = new Date(first);
    gs.setDate(first.getDate() - mondayIndex(first.getDay()));
    return toISODate(gs);
  }, [viewMonth]);

  const gridEnd = useMemo(() => {
    const last = endOfMonth(viewMonth);
    const ge = new Date(last);
    ge.setDate(last.getDate() + (6 - mondayIndex(last.getDay())));
    return toISODate(ge);
  }, [viewMonth]);

  const queryClient = useQueryClient();
  const { data: plans, isLoading: plansLoading } = useOutfitPlans(
    session?.user?.id,
    gridStart,
    gridEnd,
  );
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    toISODate(new Date()),
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  const { data: googleConnected } = useGoogleStatus(session?.user?.id, status === 'authenticated');
  const isGoogleConnected = googleConnected ?? false;

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
  }, [status, router]);

  // Fetch plans for the current month range (handled by useOutfitPlans above)

  const planMap = useMemo(() => {
    const m = new Map<string, { day?: OutfitPlanRow; night?: OutfitPlanRow }>();
    for (const p of plans || []) {
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
      queryClient.invalidateQueries({ queryKey: ['outfit-plans'] });
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
    <div className="min-h-screen">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-[#163422] font-headline">
          Calendar
        </h1>
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
            {plansLoading ? (
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
                        'rounded-xl border text-left p-2 min-h-[72px] transition relative group',
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

                      {entry && (hasDay || hasNight) && (
                        <div
                          className={`absolute bottom-full mb-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 hidden group-hover:block pointer-events-none ${
                            d.getDay() <= 2
                              ? 'left-0'
                              : d.getDay() === 0 || d.getDay() >= 6
                                ? 'right-0'
                                : 'left-1/2 -translate-x-1/2'
                          }`}
                        >
                          {entry.day && (
                            <TooltipSlotGroup
                              label="☀ Day"
                              labelColor="text-amber-600"
                              slots={entry.day.slots}
                            />
                          )}
                          {entry.night && entry.day && <div className="h-2" />}
                          {entry.night && (
                            <TooltipSlotGroup
                              label="🌙 Night"
                              labelColor="text-indigo-600"
                              slots={entry.night.slots}
                            />
                          )}
                        </div>
                      )}
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
              connected={isGoogleConnected}
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
                          onClick={() =>
                            setConfirmDeleteId(selectedPlans.day!.id!)
                          }
                          className="text-xs p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          title="Delete outfit"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="w-3.5 h-3.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
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
                      <div>
                        Top: {safeSlotName(selectedPlans.day.slots?.top)}
                      </div>
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
                    <p className="text-xs text-slate-400">
                      No day outfit saved.
                    </p>
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
                          onClick={() =>
                            setConfirmDeleteId(selectedPlans.night!.id!)
                          }
                          className="text-xs p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          title="Delete outfit"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="w-3.5 h-3.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
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
                        Bottom:{' '}
                        {safeSlotName(selectedPlans.night.slots?.bottom)}
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
                  connected={isGoogleConnected}
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
            onConfirm={() =>
              confirmDeleteId && handleDeletePlan(confirmDeleteId)
            }
            onCancel={() => setConfirmDeleteId(null)}
            loading={deletingPlanId !== null}
          />
        </div>
      </div>
    </div>
  );
}
