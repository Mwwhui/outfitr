import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

// GET /api/closet-layout — fetch the user's saved closet layout
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('closet_layouts')
      .select('layout_json')
      .eq('user_id', user_id)
      .maybeSingle();

    if (error) {
      console.error('Supabase error /api/closet-layout GET:', error);
      return NextResponse.json({ error: 'Failed to fetch layout' }, { status: 500 });
    }

    return NextResponse.json({ layout: data?.layout_json || [] });
  } catch (err) {
    console.error('API /api/closet-layout GET crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

// PUT /api/closet-layout — save the user's closet layout
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { layout } = body;

    if (!Array.isArray(layout)) {
      return NextResponse.json({ error: 'Layout must be an array' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { error } = await supabase
      .from('closet_layouts')
      .upsert(
        { user_id, layout_json: layout, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Supabase error /api/closet-layout PUT:', error);
      return NextResponse.json({ error: 'Failed to save layout' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API /api/closet-layout PUT crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}