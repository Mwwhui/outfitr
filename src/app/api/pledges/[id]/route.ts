import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

const ACTION_LABELS: Record<string, string> = {
  donate: 'Donation Pending',
  sell: 'Sale Pending',
  recycle: 'Recycling Pending',
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = supabaseServer();

    const { data: pledge, error: pledgeError } = await supabase
      .from('pledges')
      .select('id, action_type, status, item_ids, partner_id, created_at, fulfilled_at, rejection_reason')
      .eq('id', id)
      .eq('user_id', user_id)
      .single();

    if (pledgeError || !pledge) {
      return NextResponse.json({ error: 'Pledge not found' }, { status: 404 });
    }

    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(pledge.created_at).getTime()) / 86400000,
    );

    let progressPct: number;
    let statusText: string;
    switch (pledge.status) {
      case 'accepted':
        progressPct = 50;
        statusText = 'Ready for drop-off';
        break;
      case 'fulfilled':
        progressPct = 100;
        statusText = 'Completed';
        break;
      case 'rejected':
        progressPct = 0;
        statusText = 'Was rejected';
        break;
      default:
        progressPct = Math.min(30, Math.round((daysSinceCreation / 10) * 30));
        statusText = daysSinceCreation > 0
          ? `Created ${daysSinceCreation} day${daysSinceCreation !== 1 ? 's' : ''} ago`
          : 'Awaiting acceptance';
    }

    const [partnerResult, itemsResult] = await Promise.all([
      pledge.partner_id
        ? supabase
            .from('partners')
            .select('id, name, type, address, description')
            .eq('id', pledge.partner_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      pledge.item_ids && pledge.item_ids.length > 0
        ? supabase
            .from('clothes')
            .select('id, name, brand, image_url')
            .in('id', pledge.item_ids)
            .is('deleted_at', null)
        : Promise.resolve({ data: [] }),
    ]);

    const partner = partnerResult.data;
    const items = (itemsResult.data || []).map((item: { id: string; name: string; brand: string | null; image_url: string | null }) => ({
      id: item.id,
      name: item.name,
      brand: item.brand,
      image_url: item.image_url || null,
    }));

    return NextResponse.json({
      pledge: {
        id: pledge.id,
        action_type: pledge.action_type,
        status: pledge.status,
        label: ACTION_LABELS[pledge.action_type] || 'Action Pending',
        progress_pct: progressPct,
        status_text: statusText,
        partner: partner
          ? {
              id: partner.id,
              name: partner.name,
              type: partner.type,
              address: partner.address,
              description: partner.description,
            }
          : null,
        item_count: pledge.item_ids?.length || 0,
        items,
        created_at: pledge.created_at,
        fulfilled_at: pledge.fulfilled_at,
        rejection_reason: pledge.rejection_reason,
      },
    });
  } catch (error) {
    console.error('API /api/pledges/[id] crashed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
