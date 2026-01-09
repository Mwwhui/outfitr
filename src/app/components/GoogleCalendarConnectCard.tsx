'use client';

import { useSession } from 'next-auth/react';

type Props = {
  connected: boolean;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  manageHref?: string;
};

export default function GoogleCalendarConnectCard({
  connected,
  enabled,
  onToggle,
  manageHref,
}: Props) {
  const { status } = useSession();

  if (status !== 'authenticated') return null;

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-black">Google Calendar</p>
          <p className="text-xs text-slate-500 truncate">
            Events appear beside outfit plans
          </p>
        </div>

        <span
          className={[
            'text-[10px] px-2 py-[2px] rounded-md border',
            connected
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-500',
          ].join(' ')}
        >
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <label
          className={[
            'flex items-center gap-2 text-sm',
            connected ? 'text-slate-700 cursor-pointer' : 'text-slate-300',
          ].join(' ')}
        >
          <input
            type="checkbox"
            disabled={!connected}
            checked={connected && enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="accent-black"
          />
          Show events
        </label>

        {!connected ? (
          <a
            href="/api/integrations/google/start"
            className="text-xs px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
          >
            Connect
          </a>
        ) : manageHref ? (
          <a
            href={manageHref}
            className="text-xs text-slate-500 hover:text-black underline"
          >
            Manage
          </a>
        ) : (
          <a
            href="/api/integrations/google/start"
            className="text-xs text-slate-500 hover:text-black underline"
            title="Reconnect if events stop syncing"
          >
            Reconnect
          </a>
        )}
      </div>
    </div>
  );
}
