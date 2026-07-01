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

  let body: { weather: WeatherData | null; occasion: OccasionKey; seedItemIds: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid or empty request body' },
      { status: 400 },
    );
  }
  const { weather, occasion, seedItemIds } = body;

  const { data: clothes, error: clothesError } = await supabase
    .from('clothes')
    .select('id, name, type, color, season, image_url, favorite, wear_count, use_case')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .or('status.is.null,status.eq.available');

  if (clothesError || !clothes) {
    return NextResponse.json(
      { error: 'Failed to fetch clothes' },
      { status: 500 },
    );
  }

  // Compute pair frequencies from wear_logs, grouped by (date, time_slot)
  const { data: wearLogRows, error: logsError } = await supabase
    .from('wear_logs')
    .select('cloth_id, worn_at, time_slot')
    .eq('user_id', userId);

  const pairFreq: Record<string, number> = {};
  if (!logsError && wearLogRows) {
    const bySlot = new Map<string, string[]>();
    for (const log of wearLogRows) {
      const slotKey = `${log.worn_at}|${log.time_slot ?? 'day'}`;
      const arr = bySlot.get(slotKey) ?? [];
      arr.push(log.cloth_id);
      bySlot.set(slotKey, arr);
    }
    for (const ids of bySlot.values()) {
      const sorted = [...ids].sort();
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const key = `${sorted[i]}:${sorted[j]}`;
          pairFreq[key] = (pairFreq[key] ?? 0) + 1;
        }
      }
    }
  }

  const result = suggestOutfits(
    clothes,
    weather,
    occasion,
    pairFreq,
    seedItemIds ?? [],
  );

  return NextResponse.json(result);
}
