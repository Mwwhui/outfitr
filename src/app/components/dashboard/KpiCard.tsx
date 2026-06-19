'use client';

interface KpiCardProps {
  label: string;
  value: number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  suffix?: string;
  iconBg?: string;
}

export default function KpiCard({
  label,
  value,
  trend,
  trendDirection,
  icon,
  suffix,
  iconBg = 'bg-gray-100',
}: KpiCardProps) {
  const trendColor =
    trendDirection === 'up'
      ? 'text-green-600'
      : trendDirection === 'down'
        ? 'text-red-500'
        : 'text-gray-400';

  const trendArrow =
    trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→';

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 flex flex-col justify-between min-h-[120px]">
      <div className="flex items-start justify-between">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        {icon && (
          <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center text-[#0f172a]`}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2">
        <span className="text-3xl font-bold text-[#0f172a] tracking-tight">
          {value.toLocaleString()}
          {suffix && (
            <span className="text-base font-normal text-gray-400 ml-1">
              {suffix}
            </span>
          )}
        </span>
        {trend && (
          <span className={`ml-2 text-sm font-medium ${trendColor}`}>
            {trendArrow} {trend}
          </span>
        )}
      </div>
    </div>
  );
}
