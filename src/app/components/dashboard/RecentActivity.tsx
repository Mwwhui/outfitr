'use client';

import Link from 'next/link';

interface ActivityItem {
  pledge_id: string;
  partner_name: string;
  action_type: string;
  status: string;
  item_count: number;
  created_at: string;
}

interface RecentActivityProps {
  data: ActivityItem[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: string; bg: string; text: string }
> = {
  fulfilled: {
    label: 'Completed',
    icon: '✅',
    bg: 'bg-green-50',
    text: 'text-green-700',
  },
  accepted: {
    label: 'In Progress',
    icon: '⏳',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  pending: {
    label: 'Pending',
    icon: '📋',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  rejected: {
    label: 'Rejected',
    icon: '❌',
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
};

export default function RecentActivity({ data }: RecentActivityProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-2">📋</div>
        <p className="text-sm">No recent activity</p>
        <Link
          href="/pre-loved"
          className="inline-block mt-3 text-sm font-semibold text-[#163422] hover:underline"
        >
          Start with Pre-loved →
        </Link>
      </div>
    );
  }

  const timeAgo = (dateStr: string): string => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
        return (
          <div
            key={item.pledge_id}
            className="flex items-center justify-between py-2.5 px-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg shrink-0">{cfg.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#0f172a] truncate">
                  {item.item_count} item{item.item_count !== 1 ? 's' : ''}{' '}
                  {item.action_type === 'donate'
                    ? 'donated'
                    : item.action_type === 'sell'
                      ? 'to sell'
                      : 'to recycle'}{' '}
                  <span className="text-gray-500">· {item.partner_name}</span>
                </p>
                <p className="text-xs text-gray-400">{timeAgo(item.created_at)}</p>
              </div>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ml-3 ${cfg.bg} ${cfg.text}`}
            >
              {cfg.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
