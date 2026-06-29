'use client';

interface WeatherAlertProps {
  alerts: Array<{
    type: 'rain' | 'temp_drop' | 'temp_rise' | 'extreme_heat' | 'wind';
    message: string;
    icon: string;
  }>;
}

export default function WeatherAlert({ alerts }: WeatherAlertProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3"
        >
          <span className="material-symbols-outlined text-amber-600 text-xl">{alert.icon}</span>
          <p className="text-sm text-amber-800 font-medium">{alert.message}</p>
        </div>
      ))}
    </div>
  );
}
