'use client';

import { ReactNode } from 'react';
import {
  BarChart,
  Bar,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface WearMonthPoint {
  month: string;
  wears: number;
  items_worn: number;
}

interface WearingHabitsChartProps {
  data: WearMonthPoint[];
  thisMonthWears: number;
  lastMonthWears: number;
  changePct: number;
  insight: string;
  totalItems: number;
}

export default function WearingHabitsChart({
  data,
  thisMonthWears,
  lastMonthWears,
  changePct,
  insight,
  totalItems,
}: WearingHabitsChartProps) {
  const hasData = data.some((d) => d.wears > 0);

  const formatMonth = (m: string) => {
    const d = new Date(m + '-01');
    return d.toLocaleDateString('en-US', { month: 'short' });
  };

  const trendDirection =
    changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'neutral';

  const thisMonthItems = data.length > 0 ? data[data.length - 1].items_worn : 0;
  const lastMonthItems = data.length > 1 ? data[data.length - 2].items_worn : 0;
  const goalPct =
    totalItems > 0 ? Math.round((thisMonthItems / totalItems) * 100) : 0;

  const wornMonths = data.filter((d) => d.wears > 0);
  const avgWears =
    wornMonths.length > 0
      ? Math.round(
          wornMonths.reduce((s, d) => s + d.wears, 0) / wornMonths.length,
        )
      : 0;

  const CustomBar = (props: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    index?: number;
  }) => {
    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props;
    const entry = data[index];
    if (!entry || height < 1) return null;

    const isCurrent = index === data.length - 1;
    const barColor = isCurrent && entry.wears > 0 ? '#059669' : '#163422';

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={Math.max(height, 0)}
          fill={barColor}
          rx={4}
          ry={4}
        />
        {entry.wears > 0 && (
          <text
            x={x + width / 2}
            y={y - 6}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={9}
            fontWeight={500}
          >
            {entry.items_worn}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 lg:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-[#163422] font-headline">
          Monthly Wearing Habits
        </span>
      </div>

      {hasData ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 rounded-2xl p-3 lg:p-4">
              <p className="text-xs text-gray-500 mb-1">This month</p>
              <p className="text-xl lg:text-2xl font-bold text-[#0f172a]">
                {thisMonthWears}
              </p>
              <p className="text-xs text-gray-400">
                {thisMonthItems} items worn
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 lg:p-4">
              <p className="text-xs text-gray-500 mb-1">Last month</p>
              <p className="text-xl lg:text-2xl font-bold text-[#0f172a]">
                {lastMonthWears}
              </p>
              <p className="text-xs text-gray-400">
                {lastMonthItems} items worn
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 lg:p-4">
              <p className="text-xs text-gray-500 mb-1">Change</p>
              <div className="flex items-center gap-1">
                <span
                  className={`text-xl lg:text-2xl font-bold ${
                    trendDirection === 'up'
                      ? 'text-emerald-600'
                      : trendDirection === 'down'
                        ? 'text-red-500'
                        : 'text-gray-500'
                  }`}
                >
                  {changePct > 0 ? '+' : ''}
                  {changePct}%
                </span>
                <span
                  className={`text-lg ${
                    trendDirection === 'up'
                      ? 'text-emerald-600'
                      : trendDirection === 'down'
                        ? 'text-red-500'
                        : 'text-gray-500'
                  }`}
                >
                  {trendDirection === 'up'
                    ? '\u2191'
                    : trendDirection === 'down'
                      ? '\u2193'
                      : '\u2192'}
                </span>
              </div>
              <p className="text-xs text-gray-400">vs last month</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 lg:p-4">
              <p className="text-xs text-gray-500 mb-1">Goal</p>
              <p className="text-xl lg:text-2xl font-bold text-[#0f172a]">
                {thisMonthItems}
                <span className="text-sm font-normal text-gray-400">
                  /{totalItems}
                </span>
              </p>
              <p className="text-xs text-gray-400">
                {goalPct}% of wardrobe worn
              </p>
            </div>
          </div>

          {insight && (
            <div className="bg-[#0f172a] text-white text-xs rounded-xl px-4 py-2.5 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-400 text-sm shrink-0">
                  auto_awesome
                </span>
                <span className="leading-relaxed">{insight}</span>
              </div>
            </div>
          )}

          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data}
              margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                vertical={false}
              />
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
                formatter={(value, name) => {
                  const formattedValue = Array.isArray(value)
                    ? value[0]
                    : value;
                  return [
                    formattedValue ?? '',
                    name === 'wears' ? 'Wears' : 'Items worn',
                  ] as ReactNode;
                }}
              />
              <Bar dataKey="wears" shape={<CustomBar />} maxBarSize={32} />
              <Line
                type="monotone"
                dataKey="items_worn"
                stroke="#059669"
                strokeWidth={2}
                dot={{ r: 3, fill: '#059669', strokeWidth: 0 }}
                strokeDasharray="4 3"
              />
              {avgWears > 0 && (
                <ReferenceLine
                  y={avgWears}
                  stroke="#9ca3af"
                  strokeDasharray="6 4"
                  label={{
                    value: `Avg ${avgWears}`,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: '#9ca3af',
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#163422]" />
              Past months
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
              Current month
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <line
                  x1="1"
                  y1="7"
                  x2="13"
                  y2="7"
                  stroke="#059669"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                <circle cx="7" cy="7" r="2" fill="#059669" />
              </svg>
              Items worn
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0 border-t border-dashed border-gray-400" />
              Avg
            </span>
          </div>
        </>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-500">
            Start logging outfits in the{' '}
            <a
              href="/planner"
              className="font-semibold text-[#0f172a] underline underline-offset-2"
            >
              Planner
            </a>{' '}
            to see your monthly wearing habits and get personalized insights.
          </p>
        </div>
      )}
    </div>
  );
}
