import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';
import { suggestOutfits } from '@/lib/suggestOutfits';
import type { OccasionKey, WeatherData } from '@/lib/suggestOutfits';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { weather, occasion, seedItemIds } = await req.json() as {
    weather: WeatherData | null;
    occasion: OccasionKey;
    seedItemIds: string[];
  };

  const { data: clothes, error: clothesError } = await supabase
    .from('clothes')
    .select('id, name, type, color, season, image_url, favorite, wear_count')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('status', 'available');

  if (clothesError || !clothes) {
    return NextResponse.json({ error: 'Failed to fetch clothes' }, { status: 500 });
  }

  // Compute pair frequencies from wear_logs (single source of truth)
  const { data: wearLogRows, error: logsError } = await supabase
    .from('wear_logs')
    .select('cloth_id, worn_at')
    .eq('user_id', userId);

  const pairFreq: Record<string, number> = {};
  if (!logsError && wearLogRows) {
    const byDate = new Map<string, string[]>();
    for (const log of wearLogRows) {
      const arr = byDate.get(log.worn_at) ?? [];
      arr.push(log.cloth_id);
      byDate.set(log.worn_at, arr);
    }
    for (const ids of byDate.values()) {
      const sorted = [...ids].sort();
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const key = `${sorted[i]}:${sorted[j]}`;
          pairFreq[key] = (pairFreq[key] ?? 0) + 1;
        }
      }
    }
  }

  const result = suggestOutfits(clothes, weather, occasion, pairFreq, seedItemIds ?? []);

  return NextResponse.json(result);
}
