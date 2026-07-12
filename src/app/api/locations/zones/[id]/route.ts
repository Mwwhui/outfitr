import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

// PATCH /api/locations/zones/[id] — update a zone
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, type, color, display_order, pinned } = body;

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (type !== undefined) updateData.type = type;
    if (color !== undefined) updateData.color = color;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (pinned !== undefined) updateData.pinned = pinned;

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('location_zones')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error /api/locations/zones/[id] PATCH:', error);
      return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 });
    }

    return NextResponse.json({ zone: data });
  } catch (err) {
    console.error('API /api/locations/zones/[id] PATCH crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

// DELETE /api/locations/zones/[id] — delete a zone (items become unassigned)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const supabase = supabaseServer();
    const { error } = await supabase
      .from('location_zones')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id);

    if (error) {
      console.error('Supabase error /api/locations/zones/[id] DELETE:', error);
      return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API /api/locations/zones/[id] DELETE crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
