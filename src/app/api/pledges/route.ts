import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseServer();

    const { data: pledgesData, error: pledgesError } = await supabase
      .from('pledges')
      .select('id, action_type, status, item_ids, partner_id, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (pledgesError) {
      console.error('Supabase error /api/pledges:', pledgesError);
      return NextResponse.json({ error: 'Failed to fetch pledges' }, { status: 500 });
    }

    if (!pledgesData || pledgesData.length === 0) {
      return NextResponse.json({ pledges: [] });
    }

    const partnerIds = [
      ...new Set(pledgesData.filter((p) => p.partner_id).map((p) => p.partner_id)),
    ];

    let partnerNames = new Map<string, string>();
    if (partnerIds.length > 0) {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, name')
        .in('id', partnerIds);
      if (partners) {
        partnerNames = new Map(
          partners.map((p: { id: string; name: string }) => [p.id, p.name]),
        );
      }
    }

    // Fetch all items referenced by pledges
    const allItemIds = [...new Set(pledgesData.flatMap((p) => p.item_ids || []))];
    let itemMap = new Map<string, { id: string; name: string; image_url: string | null }>();
    if (allItemIds.length > 0) {
      const { data: items } = await supabase
        .from('clothes')
        .select('id, name, image_url')
        .in('id', allItemIds)
        .is('deleted_at', null);
      if (items) {
        itemMap = new Map(items.map((item: any) => [item.id, item]));
      }
    }

    const ACTION_LABELS: Record<string, string> = {
      donate: 'Donation Pending',
      sell: 'Sale Pending',
      recycle: 'Recycling Pending',
    };

    const result = pledgesData.map((pledge) => {
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

      const items = (pledge.item_ids || [])
        .map((id: string) => itemMap.get(id))
        .filter(Boolean);

      return {
        id: pledge.id,
        action_type: pledge.action_type,
        status: pledge.status,
        label: ACTION_LABELS[pledge.action_type] || 'Action Pending',
        progress_pct: progressPct,
        status_text: statusText,
        partner_name: pledge.partner_id
          ? partnerNames.get(pledge.partner_id) || 'Unknown Partner'
          : null,
        item_count: pledge.item_ids?.length || 0,
        items: items.map((item: any) => ({
          id: item.id,
          name: item.name,
          image_url: item.image_url || null,
        })),
        created_at: pledge.created_at,
      };
    });

    return NextResponse.json({ pledges: result, fallback_partner_text: 'Partner' });
  } catch (error) {
    console.error('API /api/pledges crashed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
