'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TimelinePoint {
  month: string;
  pending: number;
  accepted: number;
  fulfilled: number;
}

interface PledgeTimelineProps {
  data: TimelinePoint[];
}

export default function PledgeTimeline({ data }: PledgeTimelineProps) {
  const hasData = data.some((d) => d.pending || d.accepted || d.fulfilled);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No pledge activity yet
      </div>
    );
  }

  const formatMonth = (m: string) => {
    const d = new Date(m + '-01');
    return d.toLocaleDateString('en-US', { month: 'short' });
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="fillPending" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillAccepted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillFulfilled" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#163422" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#163422" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: '13px',
          }}
          labelFormatter={(label: React.ReactNode) => {
            if (!label || typeof label !== 'string') return '';
            const d = new Date(label + '-01');
            return d.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            });
          }}
        />
        <Area
          type="monotone"
          dataKey="pending"
          stroke="#d97706"
          fill="url(#fillPending)"
          strokeWidth={2}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="accepted"
          stroke="#2563eb"
          fill="url(#fillAccepted)"
          strokeWidth={2}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="fulfilled"
          stroke="#163422"
          fill="url(#fillFulfilled)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
