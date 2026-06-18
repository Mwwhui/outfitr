import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'partner' || !session.user.partner_id) {
      return NextResponse.json(
        { error: 'Access denied. Partner account required.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const supabase = supabaseServer();

    let query = supabase
      .from('pledges')
      .select('id, user_id, item_ids, action_type, status, rejection_reason, qr_token, created_at')
      .eq('partner_id', session.user.partner_id)
      .order('created_at', { ascending: false });

    if (statusFilter && ['pending', 'accepted', 'rejected', 'fulfilled'].includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data: pledgesData, error: pledgesError } = await query;

    if (pledgesError) {
      console.error('Supabase error /api/partner/pledges:', pledgesError);
      return NextResponse.json(
        { error: 'Failed to fetch pledges' },
        { status: 500 },
      );
    }

    if (!pledgesData || pledgesData.length === 0) {
      return NextResponse.json([]);
    }

    const userIds = [...new Set(pledgesData.map((p) => p.user_id))];

    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', userIds);

    if (usersError) {
      console.error('Supabase error fetching users:', usersError);
    }

    const userMap = new Map(
      (usersData || []).map((u) => [
        u.id,
        {
          id: u.id,
          email: u.email,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        },
      ]),
    );

    const allItemIds = pledgesData.flatMap((p) => p.item_ids || []);
    const uniqueItemIds = [...new Set(allItemIds)];

    const { data: itemsData, error: itemsError } = await supabase
      .from('clothes')
      .select('id, name, brand, image_url')
      .in('id', uniqueItemIds)
      .is('deleted_at', null);

    if (itemsError) {
      console.error('Supabase error fetching items:', itemsError);
    }

    const itemMap = new Map(
      (itemsData || []).map((item) => [item.id, item]),
    );

    const result = pledgesData.map((pledge) => ({
      id: pledge.id,
      status: pledge.status,
      action_type: pledge.action_type,
      rejection_reason: pledge.rejection_reason,
      qr_token: pledge.qr_token,
      created_at: pledge.created_at,
      user: userMap.get(pledge.user_id) || null,
      items: (pledge.item_ids || [])
        .map((id: string) => itemMap.get(id))
        .filter(Boolean),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('API /api/partner/pledges crashed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
