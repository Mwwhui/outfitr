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
    .select('id, date, time_slot, slots')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!plan) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Extract item IDs from the plan before deleting
  const planItemIds: string[] = [];
  if (plan.slots) {
    for (const item of Object.values(plan.slots)) {
      if (item && typeof item === 'object' && 'id' in item) {
        planItemIds.push((item as { id: string }).id);
      }
    }
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

  // Decrement wear counts for the plan's items
  if (planItemIds.length > 0) {
    const { error: decError } = await supabase.rpc(
      'decrement_clothes_wear_counts',
      { p_user_id: userId, p_cloth_ids: planItemIds },
    );
    if (decError) {
      console.error('Failed to decrement wear counts:', decError);
    }
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
