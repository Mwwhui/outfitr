import { supabaseServer } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';

// list authenticated user's unique materials
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;

    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from('clothes')
      .select('material')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .neq('material', '')
      .not('material', 'is', null);

    if (error) {
      console.error('Supabase error /api/materials:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }

    const materials = [...new Set(data.map((item) => item.material))].sort();

    return NextResponse.json({ materials });
  } catch (err) {
    console.error('API /api/materials crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
