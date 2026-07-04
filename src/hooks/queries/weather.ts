'use client';

import { useQuery } from '@tanstack/react-query';

export interface WeatherData {
  temperature: number;
  weathercode: number;
  description: string;
  humidity?: number;
  feelsLike?: number;
  windSpeed?: number;
}

export interface WeatherAlert {
  type: 'rain' | 'temp_drop' | 'temp_rise' | 'extreme_heat' | 'wind';
  message: string;
  icon: string;
}

export interface HourlyPoint {
  time: string;
  temp: number;
  code: number;
}

export interface WeatherResult {
  current: WeatherData;
  hourly: HourlyPoint[];
  alerts: WeatherAlert[];
}

const WMO_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Heavy thunderstorm with hail',
};

export function getWeatherIcon(code: number): string {
  if (code <= 1) return 'clear_day';
  if (code <= 3) return 'partly_cloudy_day';
  if (code <= 48) return 'foggy';
  if (code <= 55) return 'rainy_light';
  if (code <= 65) return 'rainy';
  if (code <= 75) return 'weather_snowy';
  if (code <= 82) return 'rainy';
  if (code <= 86) return 'weather_snowy';
  if (code >= 95) return 'thunderstorm';
  return 'cloud';
}

function detectWeatherAlerts(hourly: HourlyPoint[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const now = new Date();
  const currentHour = now.getHours();
  const future = hourly.filter(
    (h) => new Date(h.time).getHours() > currentHour,
  );

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

function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
    );
  });
}

async function fetchIpLocation(): Promise<{ latitude: number; longitude: number }> {
  const res = await fetch('http://ip-api.com/json/');
  if (!res.ok) throw new Error('IP geolocation failed');
  const data = await res.json();
  if (!data?.lat || !data?.lon) throw new Error('Invalid IP geolocation response');
  return { latitude: data.lat, longitude: data.lon };
}

async function resolveCoords(): Promise<{ latitude: number; longitude: number }> {
  try {
    return await getCurrentPosition();
  } catch {
    return await fetchIpLocation();
  }
}

export function useWeather(enabled = true) {
  return useQuery({
    queryKey: ['weather'],
    queryFn: async (): Promise<WeatherResult | null> => {
      try {
        const { latitude, longitude } = await resolveCoords();
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=weather_code,temperature_2m&forecast_days=1`,
        );
        const data = await res.json();
        if (!data?.current) return null;

        const current: WeatherData = {
          temperature: Math.round(data.current.temperature_2m),
          weathercode: data.current.weather_code ?? 0,
          description: WMO_LABELS[data.current.weather_code] ?? 'Unknown',
          humidity: data.current.relative_humidity_2m ?? undefined,
          feelsLike: data.current.apparent_temperature ?? undefined,
          windSpeed: data.current.wind_speed_10m ?? undefined,
        };

        const hourly: HourlyPoint[] = data.hourly?.time
          ? data.hourly.time.map((t: string, i: number) => ({
              time: t,
              temp: Math.round(data.hourly.temperature_2m[i]),
              code: data.hourly.weather_code[i],
            }))
          : [];

        const alerts = detectWeatherAlerts(hourly);

        return { current, hourly, alerts };
      } catch {
        return null;
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled,
    placeholderData: (previous) => previous,
  });
}
