import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  //optional chaining to avoid errors if session or user is undefined
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { date, timeSlot, slots } = await req.json();

  if (!date || !timeSlot || !slots) {
    return NextResponse.json(
      { error: 'date, timeSlot and slots required' },
      { status: 400 }
    );
  }

  // upsert: Insert if it doesn’t exist, update if it does
  const { error } = await supabase.from('outfit_plans').upsert(
    {
      user_id: userId,
      date,
      time_slot: timeSlot,
      slots,
    },
    { onConflict: 'user_id,date,time_slot' }
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
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
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('outfit_plans')
    .select('id, date, time_slot, slots')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
