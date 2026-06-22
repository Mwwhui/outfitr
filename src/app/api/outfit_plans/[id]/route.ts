import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Fetch the plan to verify ownership and get date+timeSlot for wear_logs cleanup
  const { data: plan, error: fetchError } = await supabase
    .from('outfit_plans')
    .select('id, date, time_slot')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!plan) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete associated wear_logs for this date + time_slot
  const { error: wearLogError } = await supabase
    .from('wear_logs')
    .delete()
    .eq('user_id', userId)
    .eq('worn_at', plan.date)
    .eq('time_slot', plan.time_slot);

  if (wearLogError) {
    console.error('Failed to delete wear logs:', wearLogError);
  }

  // Delete the outfit plan
  const { error: deleteError } = await supabase
    .from('outfit_plans')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Trigger unused score recalculation
  const origin = new URL(_req.url).origin;
  fetch(`${origin}/api/clothes/score-unused`, { method: 'POST' }).catch(
    (err: Error) => console.error('score-unused trigger failed:', err),
  );

  return NextResponse.json({ success: true });
}
