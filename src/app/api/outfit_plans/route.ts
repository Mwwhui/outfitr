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

  const { date, timeSlot, slots, name } = await req.json();

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

  const oldItemIds: string[] = [];
  if (existingPlan?.slots) {
    const ids: string[] = Object.values(existingPlan.slots)
      .filter(
        (item): item is { id: string } =>
          item !== null && typeof item === 'object' && 'id' in item,
      )
      .map((item) => item.id);
    oldItemIds.push(...ids);
  }

  // Delete wear_logs for items no longer in the outfit (replaced items)
  if (oldItemIds.length > 0) {
    const newItemIds: string[] = Object.values(slots)
      .filter(
        (item): item is { id: string } =>
          item !== null && typeof item === 'object' && 'id' in item,
      )
      .map((item) => item.id);

    const removedIds = oldItemIds.filter((id) => !newItemIds.includes(id));
    if (removedIds.length > 0) {
      await supabase
        .from('wear_logs')
        .delete()
        .eq('user_id', userId)
        .eq('worn_at', date)
        .in('cloth_id', removedIds);
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

  // Extract worn item IDs from slots
  const wornItemIds: string[] = Object.values(slots)
    .filter(
      (item): item is { id: string } =>
        item !== null && typeof item === 'object' && 'id' in item,
    )
    .map((item) => item.id);

  if (wornItemIds.length > 0) {
    // Insert wear_logs for new items
    const wearLogRows = wornItemIds.map((clothId) => ({
      user_id: userId,
      cloth_id: clothId,
      worn_at: date,
    }));

    const { error: wearLogError } = await supabase
      .from('wear_logs')
      .upsert(wearLogRows, {
        onConflict: 'user_id,cloth_id,worn_at',
        ignoreDuplicates: true,
      });

    if (wearLogError) {
      console.error('Failed to insert wear logs:', wearLogError);
    } else {
      // 6. Increment wear_count directly (atomic, not fire-and-forget)
      const { error: wearCountError } = await supabase.rpc(
        'increment_clothes_wear_counts',
        {
          p_user_id: userId,
          p_cloth_ids: wornItemIds,
        },
      );

      if (wearCountError) {
        console.error('Failed to increment wear counts:', wearCountError);
      }

      // Trigger score-unused in background for unused_score recalculation
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
