'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

export interface AlertItem {
  id: string;
  type: 'weather' | 'pledge_pending' | 'pledge_accepted' | 'unused_items' | 'calendar_reconnect' | 'overconsumption' | 'wear_streak';
  icon: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  discoveredAt: number;
}

interface HomeAlertsData {
  pledges_pending: number;
  pledges_accepted: number;
  pledges_total: number;
  unused_items_count: number;
  items_added_30d: number;
  total_items: number;
  months_active: number;
}

interface WeatherAlert {
  type: 'rain' | 'temp_drop' | 'extreme_heat';
  message: string;
  icon: string;
}

function hashContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) + content.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
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

function makeId(prefix: string, content: string): string {
  return `${prefix}-${hashContent(content)}`;
}

const COORDS_CACHE_KEY = 'alertBell_weather_coords';
const COORDS_CACHE_TTL = 30 * 60 * 1000;

function getCachedCoords(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem(COORDS_CACHE_KEY);
    if (raw) {
      const { lat, lon, ts } = JSON.parse(raw);
      if (Date.now() - ts < COORDS_CACHE_TTL) return { lat, lon };
    }
  } catch { /* ignore */ }
  return null;
}

function setCachedCoords(lat: number, lon: number) {
  try {
    localStorage.setItem(COORDS_CACHE_KEY, JSON.stringify({ lat, lon, ts: Date.now() }));
  } catch { /* ignore */ }
}

function requestPosition(timeout = 5000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout, enableHighAccuracy: false });
  });
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const prevAcceptedRef = useRef<number>(0);
  const costPerWearNotifiedRef = useRef(false);
  const lastStreakMilestoneRef = useRef(0);
  const prevAlertIdsRef = useRef<Set<string>>(new Set());
  const lastFetchRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Seen IDs stored in localStorage so persistent alerts (same content-hash)
  // don't reappear as unread after the user has viewed them.
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('alertBell_seenIds');
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  const saveSeenIds = useCallback((ids: Set<string>) => {
    localStorage.setItem('alertBell_seenIds', JSON.stringify([...ids]));
  }, []);

  const markRead = useCallback(() => {
    const newSeen = new Set(alerts.map((a) => a.id));
    setSeenIds(newSeen);
    saveSeenIds(newSeen);
  }, [alerts, saveSeenIds]);

  const isAlertRead = useCallback((id: string) => seenIds.has(id), [seenIds]);

  const dismissAlert = useCallback((id: string) => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSeenIds(next);
      return next;
    });
  }, [saveSeenIds]);

  const fetchAlerts = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      const homeRes = await fetch('/api/home/alerts', { signal });
      const defaultHome: HomeAlertsData = {
        pledges_pending: 0, pledges_accepted: 0, pledges_total: 0,
        unused_items_count: 0, items_added_30d: 0, total_items: 0, months_active: 1,
      };
      const homeData: HomeAlertsData = homeRes.ok ? await homeRes.json() : defaultHome;

      let calendarNeedsReconnect = false;
      try {
        const calRes = await fetch('/api/integrations/google/status', { signal });
        if (calRes.ok) {
          const calData = await calRes.json();
          calendarNeedsReconnect = calData.connected && calData.needsReconnect;
        }
      } catch {
        // silently fail
      }

      let weatherAlerts: WeatherAlert[] = [];
      try {
        let lat = 1.3521;
        let lon = 103.8198;
        const cached = getCachedCoords();
        if (cached) {
          lat = cached.lat;
          lon = cached.lon;
        } else if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          try {
            const pos = await requestPosition();
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            setCachedCoords(lat, lon);
          } catch {
            // use fallback
          }
        }
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode&timezone=auto&forecast_days=1`,
          { signal }
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

      // Fetch wardrobe insights for additional alert types
      let wearStreak = 0;
      let itemsWornThisMonth = 0;
      let totalWardrobeItems = 0;
      let costPerWearTrend: string | undefined;
      try {
        const insightsRes = await fetch('/api/wardrobe/monthly-insights', { signal });
        if (insightsRes.ok) {
          const insights = await insightsRes.json();
          if (!insights.insufficient_data) {
            wearStreak = insights.wear_streak || 0;
            itemsWornThisMonth = insights.wardrobe_health?.items_worn_this_month || 0;
            totalWardrobeItems = insights.wardrobe_health?.total_items || 0;
            costPerWearTrend = insights.wardrobe_health?.cost_per_wear_trend;
          }
        }
      } catch {
        // silently fail
      }

      const now = Date.now();
      const items: AlertItem[] = [];

      weatherAlerts.forEach((w) => {
        items.push({
          id: makeId('weather', w.message + 'warning'),
          type: 'weather',
          icon: w.icon,
          message: w.message,
          actionLabel: 'View on Home',
          actionHref: '/home',
          severity: 'warning',
          discoveredAt: now,
        });
      });

      if (calendarNeedsReconnect) {
        items.push({
          id: 'calendar-reconnect',
          type: 'calendar_reconnect',
          icon: 'link_off',
          message: 'Google Calendar disconnected — reconnect to see events',
          actionLabel: 'Reconnect',
          actionHref: '/api/integrations/google/start',
          severity: 'error',
          discoveredAt: now,
        });
      }

      if (homeData.pledges_pending > 0) {
        items.push({
          id: makeId('pledges-pending', `${homeData.pledges_pending}`),
          type: 'pledge_pending',
          icon: 'pending_actions',
          message: `${homeData.pledges_pending} pending pledge${homeData.pledges_pending !== 1 ? 's' : ''} awaiting partner acceptance`,
          actionLabel: 'View Activity',
          actionHref: '/activity',
          severity: 'info',
          discoveredAt: now,
        });
      }

      if (homeData.pledges_accepted > 0) {
        items.push({
          id: makeId('pledges-accepted', `${homeData.pledges_accepted}`),
          type: 'pledge_accepted',
          icon: 'check_circle',
          message: `${homeData.pledges_accepted} pledge${homeData.pledges_accepted !== 1 ? 's' : ''} accepted — check your email for QR code`,
          actionLabel: 'View Activity',
          actionHref: '/activity',
          severity: 'success',
          discoveredAt: now,
        });

        if (prevAcceptedRef.current > 0 && homeData.pledges_accepted > prevAcceptedRef.current) {
          toast.success('A pledge was accepted! Check your email for the QR code.');
        }
      }

      prevAcceptedRef.current = homeData.pledges_accepted;

      if (homeData.unused_items_count > 3) {
        items.push({
          id: makeId('unused-items', `${homeData.unused_items_count}`),
          type: 'unused_items',
          icon: 'checkroom',
          message: `${homeData.unused_items_count} items haven't been worn recently — consider pre-loving them`,
          actionLabel: 'Go to Pre-Loved',
          actionHref: '/pre-loved',
          severity: 'warning',
          discoveredAt: now,
        });
      }

      // Overconsumption alert
      const { items_added_30d, total_items, months_active } = homeData;
      const historicalMonthlyAvg = total_items / months_active;
      const ratio = historicalMonthlyAvg > 0 ? items_added_30d / historicalMonthlyAvg : items_added_30d;

      if (items_added_30d >= 3 && ratio > 2.0) {
        items.push({
          id: makeId('overconsumption', `${items_added_30d}-${Math.round(historicalMonthlyAvg)}`),
          type: 'overconsumption',
          icon: 'shopping_cart',
          message: `You added ${items_added_30d} items this month (${Math.round(ratio)}x your avg of ${Math.round(historicalMonthlyAvg)}/mo) — your wardrobe is growing fast. Consider mindful purchasing.`,
          actionLabel: 'Review Wardrobe',
          actionHref: '/wardrobe',
          severity: 'error',
          discoveredAt: now,
        });
      } else if (items_added_30d >= 3 && ratio > 1.5) {
        items.push({
          id: makeId('overconsumption', `${items_added_30d}-${Math.round(historicalMonthlyAvg)}`),
          type: 'overconsumption',
          icon: 'shopping_cart',
          message: `You added ${items_added_30d} items this month (vs your avg of ${Math.round(historicalMonthlyAvg)}/mo) — are these all intentional purchases?`,
          actionLabel: 'Review Wardrobe',
          actionHref: '/wardrobe',
          severity: 'warning',
          discoveredAt: now,
        });
      }

      // Wear streak milestone
      const streakMilestones = [3, 7, 14, 30];
      const newMilestone = streakMilestones.find(
        (m) => wearStreak >= m && m > lastStreakMilestoneRef.current
      );
      if (newMilestone) {
        lastStreakMilestoneRef.current = newMilestone;
        const dayLabel = newMilestone >= 7 ? ` for ${newMilestone} days` : '';
        items.push({
          id: makeId('wear-streak', `${newMilestone}`),
          type: 'wear_streak',
          icon: 'local_fire_department',
          message: `${newMilestone}-day wear streak! You've worn something every day${dayLabel}.`,
          actionLabel: 'View Dashboard',
          actionHref: '/dashboard',
          severity: 'success',
          discoveredAt: now,
        });
      }

      // Low rotation alert
      if (totalWardrobeItems >= 5 && itemsWornThisMonth > 0 && (itemsWornThisMonth / totalWardrobeItems) < 0.3) {
        items.push({
          id: makeId('low-rotation', `${Math.round((itemsWornThisMonth / totalWardrobeItems) * 100)}`),
          type: 'wear_streak',
          icon: 'sync_alt',
          message: `You've only worn ${itemsWornThisMonth} of ${totalWardrobeItems} items this month — try rotating in some neglected pieces.`,
          actionLabel: 'View Outfits',
          actionHref: '/outfits',
          severity: 'info',
          discoveredAt: now,
        });
      }

      // Cost-per-wear improving alert
      if (costPerWearTrend === 'down' && !costPerWearNotifiedRef.current) {
        costPerWearNotifiedRef.current = true;
        items.push({
          id: 'cpw-improving',
          type: 'wear_streak',
          icon: 'trending_down',
          message: `Your cost-per-wear is dropping — you're getting great value from your wardrobe!`,
          actionLabel: 'View Dashboard',
          actionHref: '/dashboard',
          severity: 'success',
          discoveredAt: now,
        });
      }

      // Priority sort: error → warning → success → info
      const severityOrder: Record<string, number> = { error: 0, warning: 1, success: 2, info: 3 };
      items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      // Push notifications for new critical alerts
      const currentIds = new Set(items.map((a) => a.id));
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const prevIds = prevAlertIdsRef.current;
        for (const alert of items) {
          if (!prevIds.has(alert.id) && (alert.severity === 'error' || alert.severity === 'warning')) {
            new Notification('Outfitr', {
              body: alert.message,
              icon: '/logo.png',
              tag: alert.id,
            });
          }
        }
      }
      prevAlertIdsRef.current = currentIds;

      setAlerts(items);
      setHasLoaded(true);
      lastFetchRef.current = Date.now();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setHasLoaded(true);
      lastFetchRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    const interval = setInterval(fetchAlerts, 300000);

    const handleFocus = () => {
      if (Date.now() - lastFetchRef.current < 60000) return;
      fetchAlerts();
    };
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchRef.current < 60000) return;
      fetchAlerts();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      abortRef.current?.abort();
    };
  }, [fetchAlerts]);

  const unreadCount = alerts.filter((a) => !seenIds.has(a.id)).length;

  // Tab badge: update document title with unread count
  const originalTitle = useRef('');
  useEffect(() => {
    originalTitle.current = document.title;
  }, []);

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Outfitr` : (originalTitle.current || 'Outfitr');
  }, [unreadCount]);

  return { alerts, total: alerts.length, unreadCount, hasLoaded, markRead, isAlertRead, dismissAlert };
}
