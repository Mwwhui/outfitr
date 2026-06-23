import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';
import { render } from 'react-email';
import { resend } from '@/lib/resend';
import PledgeConfirmation from '@/emails/pledge-confirmation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_ACTION_TYPES = ['donate', 'sell', 'recycle'] as const;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { partnerId, itemIds, actionType } = body as {
      partnerId: unknown;
      itemIds: unknown;
      actionType: unknown;
    };

    if (!partnerId || typeof partnerId !== 'string') {
      return NextResponse.json(
        { error: 'partnerId is required and must be a string' },
        { status: 400 },
      );
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds is required and must be a non-empty array' },
        { status: 400 },
      );
    }

    if (itemIds.some((id: unknown) => typeof id !== 'string')) {
      return NextResponse.json(
        { error: 'All itemIds must be strings' },
        { status: 400 },
      );
    }

    const safeActionType = actionType as typeof VALID_ACTION_TYPES[number];

    if (!VALID_ACTION_TYPES.includes(safeActionType)) {
      return NextResponse.json(
        { error: 'actionType must be donate, sell, or recycle' },
        { status: 400 },
      );
    }

    const trimmedItemIds = itemIds as string[];

    const { data: partnerData, error: partnerError } = await supabase
      .from('partners')
      .select('id, name')
      .eq('id', partnerId)
      .maybeSingle();

    if (partnerError || !partnerData) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 },
      );
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('clothes')
      .select('id, name, brand, image_url')
      .in('id', trimmedItemIds)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (itemsError || !itemsData || itemsData.length !== trimmedItemIds.length) {
      return NextResponse.json(
        { error: 'One or more items not found or do not belong to you' },
        { status: 400 },
      );
    }

    const { data: pledgeData, error: insertError } = await supabase
      .from('pledges')
      .insert({
        user_id: userId,
        partner_id: partnerId,
        item_ids: trimmedItemIds,
        action_type: safeActionType,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert error /api/pledges:', insertError);
      return NextResponse.json(
        { error: 'Failed to create pledge' },
        { status: 500 },
      );
    }

    const emailHtml = await render(
      <PledgeConfirmation
        userName={session.user.name || 'User'}
        partnerName={partnerData.name}
        partnerType={safeActionType}
        items={itemsData.map((item) => ({
          name: item.name,
          brand: item.brand,
          image_url: item.image_url,
        }))}
        pledgeId={pledgeData.id}
      />,
    );

    const { error: emailError } = await resend.emails.send({
      from: 'Outfitr <onboarding@resend.dev>',
      to: userEmail,
      subject: `Your ${safeActionType} request has been submitted`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Resend email error /api/pledges:', emailError);
    }

    return NextResponse.json({ success: true, pledgeId: pledgeData.id }, { status: 201 });
  } catch (err) {
    console.error('API /api/pledges crashed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
