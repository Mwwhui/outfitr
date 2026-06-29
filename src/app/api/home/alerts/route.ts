import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

// GET /api/home/alerts
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseServer();

    const { data: pledges, error: pledgesError } = await supabase
      .from('pledges')
      .select('status')
      .eq('user_id', user_id);

    if (pledgesError) {
      console.error('Home alerts pledges error:', pledgesError);
    }

    const pending = (pledges || []).filter((p) => p.status === 'pending').length;
    const accepted = (pledges || []).filter((p) => p.status === 'accepted').length;

    const { data: unusedItems, error: unusedError } = await supabase
      .from('clothes')
      .select('id')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available')
      .gt('unused_score', 0.7);

    if (unusedError) {
      console.error('Home alerts unused error:', unusedError);
    }

    return NextResponse.json({
      pledges_pending: pending,
      pledges_accepted: accepted,
      unused_items_count: (unusedItems || []).length,
    });
  } catch (error) {
    console.error('API /api/home/alerts crashed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Error' },
      { status: 500 }
    );
  }
}
