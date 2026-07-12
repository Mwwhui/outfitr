import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

// GET /api/locations/zones — list all zones for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('location_zones')
      .select('*')
      .eq('user_id', user_id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase error /api/locations/zones GET:', error);
      return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 });
    }

    return NextResponse.json({ zones: data || [] });
  } catch (err) {
    console.error('API /api/locations/zones GET crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

// POST /api/locations/zones — create a new zone
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, type, color } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const validTypes = ['shelf', 'drawer', 'hanging', 'other'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: 'Type must be shelf, drawer, hanging, or other' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Get max display_order
    const { data: maxData } = await supabase
      .from('location_zones')
      .select('display_order')
      .eq('user_id', user_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxData?.display_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('location_zones')
      .insert({
        user_id,
        name: name.trim(),
        type,
        display_order: nextOrder,
        color: color || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error /api/locations/zones POST:', error);
      return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 });
    }

    return NextResponse.json({ zone: data }, { status: 201 });
  } catch (err) {
    console.error('API /api/locations/zones POST crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
