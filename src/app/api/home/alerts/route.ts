import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

const ALERTS_CACHE = new Map<string, { data: unknown; ts: number }>();
const ALERTS_CACHE_TTL = 30 * 1000;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cached = ALERTS_CACHE.get(user_id);
    if (cached && Date.now() - cached.ts < ALERTS_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = supabaseServer();

    const { data: pledges, error: pledgesError } = await supabase
      .from('pledges')
      .select('status')
      .eq('user_id', user_id);

    if (pledgesError) {
      console.error('Home alerts pledges error:', pledgesError);
    }

    const pending = (pledges || []).filter(
      (p) => p.status === 'pending',
    ).length;
    const accepted = (pledges || []).filter(
      (p) => p.status === 'accepted',
    ).length;

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

    // Overconsumption data: items added in last 30 days + earliest item date
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: recentItems, error: recentError } = await supabase
      .from('clothes')
      .select('id')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available')
      .gte('created_at', thirtyDaysAgo);

    if (recentError) {
      console.error('Home alerts recent items error:', recentError);
    }

    const { data: firstItem, error: firstItemError } = await supabase
      .from('clothes')
      .select('created_at')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available')
      .order('created_at', { ascending: true })
      .limit(1);

    if (firstItemError) {
      console.error('Home alerts first item error:', firstItemError);
    }

    const { count: totalCount, error: totalError } = await supabase
      .from('clothes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available');

    if (totalError) {
      console.error('Home alerts total count error:', totalError);
    }

    const itemsAdded30d = (recentItems || []).length;
    const earliestDate = firstItem?.[0]?.created_at;
    const daysSinceFirstItem = earliestDate
      ? Math.max(1, (Date.now() - new Date(earliestDate).getTime()) / 86400000)
      : 1;
    const monthsActive = Math.round(daysSinceFirstItem / 30);

    const result = {
      pledges_pending: pending,
      pledges_accepted: accepted,
      pledges_total: (pledges || []).length,
      unused_items_count: (unusedItems || []).length,
      items_added_30d: itemsAdded30d,
      total_items: totalCount ?? 0,
      months_active: Math.max(1, monthsActive),
    };

    ALERTS_CACHE.set(user_id, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API /api/home/alerts crashed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Error' },
      { status: 500 },
    );
  }
}
