import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  //optional chaining to avoid errors if session or user is undefined
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { date: string; timeSlot: string; slots: unknown; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid or empty request body' },
      { status: 400 },
    );
  }
  const { date, timeSlot, slots, name } = body;

  if (!date || !timeSlot || !slots) {
    return NextResponse.json(
      { error: 'date, timeSlot and slots required' },
      { status: 400 },
    );
  }

  // Fetch existing plan for this date+timeSlot to detect replaced items
  const { data: existingPlan } = await supabase
    .from('outfit_plans')
    .select('slots')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('time_slot', timeSlot)
    .maybeSingle();

  const oldIds = new Set<string>();
  if (existingPlan?.slots) {
    for (const item of Object.values(existingPlan.slots)) {
      if (item && typeof item === 'object' && 'id' in item) {
        oldIds.add((item as { id: string }).id);
      }
    }
  }

  // Extract new item IDs
  const newIds = new Set<string>();
  for (const item of Object.values(slots)) {
    if (item && typeof item === 'object' && 'id' in item) {
      newIds.add((item as { id: string }).id);
    }
  }

  // Delete wear_logs for items removed from the outfit
  const removedIds = [...oldIds].filter((id) => !newIds.has(id));
  if (removedIds.length > 0) {
    await supabase
      .from('wear_logs')
      .delete()
      .eq('user_id', userId)
      .eq('worn_at', date)
      .eq('time_slot', timeSlot)
      .in('cloth_id', removedIds);

    // Decrement wear counts for removed items
    const { error: decError } = await supabase.rpc(
      'decrement_clothes_wear_counts',
      { p_user_id: userId, p_cloth_ids: removedIds },
    );
    if (decError) {
      console.error('Failed to decrement wear counts for removed items:', decError);
    }
  }

  // Upsert the outfit plan
  const { error } = await supabase.from('outfit_plans').upsert(
    {
      user_id: userId,
      date,
      time_slot: timeSlot,
      slots,
      name: name || null,
    },
    { onConflict: 'user_id,date,time_slot' },
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const newItemIds = [...newIds];
  const today = new Date().toISOString().slice(0, 10);

  if (newItemIds.length > 0 && date <= today) {
    // Insert wear_logs for new items (with time_slot for accurate pair grouping)
    const wearLogRows = newItemIds.map((clothId) => ({
      user_id: userId,
      cloth_id: clothId,
      worn_at: date,
      time_slot: timeSlot,
    }));

    const { error: wearLogError } = await supabase
      .from('wear_logs')
      .upsert(wearLogRows, {
        onConflict: 'user_id,cloth_id,worn_at,time_slot',
        ignoreDuplicates: true,
      });

    if (wearLogError) {
      console.error('Failed to insert wear logs:', wearLogError);
    } else {
      // Only increment wear_count for items that are genuinely NEW logs
      // (items that were already logged for this date+slot are skipped)
      const trulyNewIds = newItemIds.filter((id) => !oldIds.has(id));
      if (trulyNewIds.length > 0) {
        const { error: wearCountError } = await supabase.rpc(
          'increment_clothes_wear_counts',
          { p_user_id: userId, p_cloth_ids: trulyNewIds },
        );
        if (wearCountError) {
          console.error('Failed to increment wear counts:', wearCountError);
        }
      }

      const origin = new URL(req.url).origin;
      fetch(`${origin}/api/clothes/score-unused`, { method: 'POST' }).catch(
        (err: Error) => console.error('score-unused trigger failed:', err),
      );
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json(
      { error: 'from and to query params are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('outfit_plans')
    .select('id, date, time_slot, slots, name')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
