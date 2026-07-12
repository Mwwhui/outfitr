import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

// PATCH /api/clothes/batch-reorder — batch update zone_id and sort_order
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { items } = body as {
      items: Array<{ id: string; zone_id: string | null; sort_order: number }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Verify all items belong to the user
    const itemIds = items.map((i) => i.id);
    const { data: existingItems, error: verifyError } = await supabase
      .from('clothes')
      .select('id')
      .in('id', itemIds)
      .eq('user_id', user_id)
      .is('deleted_at', null);

    if (verifyError) {
      console.error('Supabase error /api/clothes/batch-reorder verify:', verifyError);
      return NextResponse.json({ error: 'Failed to verify items' }, { status: 500 });
    }

    const validIds = new Set((existingItems || []).map((i) => i.id));
    if (validIds.size !== itemIds.length) {
      return NextResponse.json(
        { error: 'One or more items do not belong to you' },
        { status: 403 }
      );
    }

    // Batch update using a transaction via RPC or individual updates
    // Supabase JS doesn't support true transactions, so we do sequential updates
    const updateErrors: string[] = [];
    for (const item of items) {
      const { error } = await supabase
        .from('clothes')
        .update({
          zone_id: item.zone_id,
          sort_order: item.sort_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('user_id', user_id);

      if (error) {
        updateErrors.push(`${item.id}: ${error.message}`);
      }
    }

    if (updateErrors.length > 0) {
      console.error('Batch reorder errors:', updateErrors);
      return NextResponse.json(
        { error: 'Some items failed to update', details: updateErrors },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, updated: items.length });
  } catch (err) {
    console.error('API /api/clothes/batch-reorder crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
