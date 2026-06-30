'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

export interface AlertItem {
  id: string;
  type: 'weather' | 'pledge_pending' | 'pledge_accepted' | 'unused_items' | 'calendar_reconnect';
  icon: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  severity: 'info' | 'warning' | 'success' | 'error';
}

interface HomeAlertsData {
  pledges_pending: number;
  pledges_accepted: number;
  unused_items_count: number;
}

interface WeatherAlert {
  type: 'rain' | 'temp_drop' | 'extreme_heat';
  message: string;
  icon: string;
}

function detectWeatherAlerts(hourly: { time: string; temp: number; code: number }[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const now = new Date();
  const currentHour = now.getHours();
  const future = hourly.filter((h) => new Date(h.time).getHours() > currentHour);

  const rainSoon = future.find((h) => h.code >= 51 && h.code <= 67);
  if (rainSoon) {
    const hour = new Date(rainSoon.time).getHours();
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour > 12 ? hour - 12 : hour;
    alerts.push({
      type: 'rain',
      message: `Rain expected at ${displayHour}${ampm} — don't forget an umbrella`,
      icon: 'umbrella',
    });
  }

  if (hourly.length >= 2) {
    const current = hourly[0].temp;
    const evening = hourly[Math.min(hourly.length - 1, 12)].temp;
    if (current - evening >= 5) {
      alerts.push({
        type: 'temp_drop',
        message: `Temperature dropping to ${evening}°C this evening — grab a layer`,
        icon: 'thermometer',
      });
    }
  }

  const maxTemp = Math.max(...hourly.map((h) => h.temp));
  if (maxTemp >= 32) {
    alerts.push({
      type: 'extreme_heat',
      message: `High of ${maxTemp}°C today — stay cool and hydrated`,
      icon: 'wb_sunny',
    });
  }

  return alerts;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const prevAcceptedRef = useRef<number>(0);

  const fetchAlerts = useCallback(async () => {
    try {
      // Fetch home alerts (pledges + unused items)
      const homeRes = await fetch('/api/home/alerts');
      const homeData: HomeAlertsData = homeRes.ok ? await homeRes.json() : { pledges_pending: 0, pledges_accepted: 0, unused_items_count: 0 };

      // Check calendar connection
      let calendarNeedsReconnect = false;
      try {
        const calRes = await fetch('/api/integrations/google/status');
        if (calRes.ok) {
          const calData = await calRes.json();
          calendarNeedsReconnect = calData.connected && calData.needsReconnect;
        }
      } catch {
        // silently fail
      }

      // Fetch weather
      let weatherAlerts: WeatherAlert[] = [];
      try {
        const lat = 1.3521;
        const lon = 103.8198;
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode&timezone=Asia%2FSingapore&forecast_days=1`
        );
        if (weatherRes.ok) {
          const weatherData = await weatherRes.json();
          if (weatherData.hourly) {
            const hourly = weatherData.hourly.time.map((t: string, i: number) => ({
              time: t,
              temp: weatherData.hourly.temperature_2m[i],
              code: weatherData.hourly.weathercode[i],
            }));
            weatherAlerts = detectWeatherAlerts(hourly);
          }
        }
      } catch {
        // silently fail
      }

      // Build alert items
      const items: AlertItem[] = [];

      // Weather alerts
      weatherAlerts.forEach((w, i) => {
        items.push({
          id: `weather-${i}`,
          type: 'weather',
          icon: w.icon,
          message: w.message,
          actionLabel: 'View on Home',
          actionHref: '/home',
          severity: 'warning',
        });
      });

      // Calendar reconnect
      if (calendarNeedsReconnect) {
        items.push({
          id: 'calendar-reconnect',
          type: 'calendar_reconnect',
          icon: 'link_off',
          message: 'Google Calendar disconnected — reconnect to see events',
          actionLabel: 'Reconnect',
          actionHref: '/api/integrations/google/start',
          severity: 'error',
        });
      }

      // Pending pledges
      if (homeData.pledges_pending > 0) {
        items.push({
          id: 'pledges-pending',
          type: 'pledge_pending',
          icon: 'pending_actions',
          message: `${homeData.pledges_pending} pending pledge${homeData.pledges_pending !== 1 ? 's' : ''} awaiting partner acceptance`,
          actionLabel: 'View Activity',
          actionHref: '/activity',
          severity: 'info',
        });
      }

      // Accepted pledges
      if (homeData.pledges_accepted > 0) {
        items.push({
          id: 'pledges-accepted',
          type: 'pledge_accepted',
          icon: 'check_circle',
          message: `${homeData.pledges_accepted} pledge${homeData.pledges_accepted !== 1 ? 's' : ''} accepted — check your email for QR code`,
          actionLabel: 'View Activity',
          actionHref: '/activity',
          severity: 'success',
        });

        // Toast for newly accepted pledges
        if (prevAcceptedRef.current > 0 && homeData.pledges_accepted > prevAcceptedRef.current) {
          toast.success('A pledge was accepted! Check your email for the QR code.');
        }
      }

      prevAcceptedRef.current = homeData.pledges_accepted;

      // Unused items
      if (homeData.unused_items_count > 3) {
        items.push({
          id: 'unused-items',
          type: 'unused_items',
          icon: 'checkroom',
          message: `${homeData.unused_items_count} items haven't been worn recently — consider pre-loving them`,
          actionLabel: 'Go to Pre-Loved',
          actionHref: '/pre-loved',
          severity: 'warning',
        });
      }

      setAlerts(items);
      setHasLoaded(true);
    } catch {
      // silently fail
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    const interval = setInterval(fetchAlerts, 60000);

    const handleFocus = () => fetchAlerts();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchAlerts();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchAlerts]);

  return { alerts, total: alerts.length, hasLoaded };
}
