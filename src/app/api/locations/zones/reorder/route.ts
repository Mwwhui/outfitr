import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

// PUT /api/locations/zones/reorder — batch update display_order
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { zoneIds } = body as { zoneIds: string[] };

    if (!Array.isArray(zoneIds) || zoneIds.length === 0) {
      return NextResponse.json({ error: 'zoneIds array is required' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Verify all zones belong to the user
    const { data: existing, error: verifyError } = await supabase
      .from('location_zones')
      .select('id')
      .eq('user_id', user_id);

    if (verifyError) {
      return NextResponse.json({ error: 'Failed to verify zones' }, { status: 500 });
    }

    const validIds = new Set((existing || []).map((z) => z.id));
    const invalid = zoneIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: 'Some zones do not belong to you' }, { status: 403 });
    }

    // Update display_order based on array index
    const updateErrors: string[] = [];
    for (let i = 0; i < zoneIds.length; i++) {
      const { error } = await supabase
        .from('location_zones')
        .update({ display_order: i, updated_at: new Date().toISOString() })
        .eq('id', zoneIds[i])
        .eq('user_id', user_id);

      if (error) {
        updateErrors.push(`${zoneIds[i]}: ${error.message}`);
      }
    }

    if (updateErrors.length > 0) {
      return NextResponse.json(
        { error: 'Some zones failed to update', details: updateErrors },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API /api/locations/zones/reorder crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
