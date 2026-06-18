import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';
import { render } from 'react-email';
import { resend } from '@/lib/resend';
import QRCode from 'qrcode';
import PledgeAccepted from '@/emails/pledge-accepted';
import PledgeRejected from '@/emails/pledge-rejected';
import PledgeFulfilled from '@/emails/pledge-fulfilled';

const supabase = supabaseServer();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const { data: pledge, error: pledgeError } = await supabase
      .from('pledges')
      .select(
        'id, user_id, item_ids, action_type, status, qr_token, created_at, fulfilled_at',
      )
      .eq('id', id)
      .eq('partner_id', session.user.partner_id)
      .single();

    if (pledgeError || !pledge) {
      return NextResponse.json(
        { error: 'Pledge not found' },
        { status: 404 },
      );
    }

    if (token !== pledge.qr_token) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 },
      );
    }

    const [userResult, partnerResult, itemsResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('id', pledge.user_id)
        .single(),
      supabase
        .from('partners')
        .select('id, name')
        .eq('id', session.user.partner_id)
        .maybeSingle(),
      supabase
        .from('clothes')
        .select('id, name, brand, image_url, status')
        .in('id', pledge.item_ids || []),
    ]);

    if (userResult.error || !userResult.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (partnerResult.error || !partnerResult.data) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      pledge: {
        id: pledge.id,
        status: pledge.status,
        action_type: pledge.action_type,
        created_at: pledge.created_at,
        fulfilled_at: pledge.fulfilled_at,
        user: {
          first_name: userResult.data.first_name,
          last_name: userResult.data.last_name,
          email: userResult.data.email,
        },
        items: (itemsResult.data || []).map((item) => ({
          id: item.id,
          name: item.name,
          brand: item.brand,
          image_url: item.image_url,
          status: item.status,
        })),
        partner_name: partnerResult.data.name,
      },
    });
  } catch (err) {
    console.error('GET /api/partner/pledges/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

    const body = await req.json();
    const { action, rejection_reason, token } = body as {
      action: string;
      rejection_reason?: string;
      token?: string;
    };

    if (!action || !['accept', 'reject', 'fulfill'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "accept", "reject", or "fulfill"' },
        { status: 400 },
      );
    }

    const { data: pledge, error: pledgeError } = await supabase
      .from('pledges')
      .select('id, user_id, item_ids, action_type, status, qr_token, created_at')
      .eq('id', id)
      .eq('partner_id', session.user.partner_id)
      .single();

    if (pledgeError || !pledge) {
      return NextResponse.json(
        { error: 'Pledge not found' },
        { status: 404 },
      );
    }

    if (action !== 'fulfill' && pledge.status !== 'pending') {
      return NextResponse.json(
        { error: 'Pledge has already been processed' },
        { status: 400 },
      );
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('id', pledge.user_id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: partnerData, error: partnerError } = await supabase
      .from('partners')
      .select('id, name')
      .eq('id', session.user.partner_id)
      .maybeSingle();

    if (partnerError || !partnerData) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('clothes')
      .select('id, name, brand')
      .in('id', pledge.item_ids || [])
      .is('deleted_at', null);

    if (itemsError) {
      console.error('Error fetching items for email:', itemsError);
    }

    const items = (itemsData || []).map((item) => ({
      name: item.name,
      brand: item.brand,
    }));

    const userName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User';

    if (action === 'accept') {
      const qrToken = crypto.randomUUID();
      const qrData = `outfitr://pledge/${id}?token=${qrToken}`;
      const qrBuffer = await QRCode.toBuffer(qrData, {
        width: 400,
        margin: 2,
        color: { dark: '#163422', light: '#ffffff' },
      });

      const { error: updateError } = await supabase
        .from('pledges')
        .update({
          status: 'accepted',
          qr_token: qrToken,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to accept pledge' },
          { status: 500 },
        );
      }

      const emailHtml = await render(
        <PledgeAccepted
          userName={userName}
          partnerName={partnerData.name}
          partnerType={pledge.action_type as 'donate' | 'sell' | 'recycle'}
          items={items}
          pledgeId={id}
        />,
      );

      const { error: emailError } = await resend.emails.send({
        from: 'Outfitr <onboarding@resend.dev>',
        to: userData.email,
        subject: `Your ${pledge.action_type} request has been accepted!`,
        html: emailHtml,
        attachments: [
          {
            filename: 'qr-code.png',
            content: qrBuffer,
            contentId: 'qr-code',
          },
        ],
      });

      if (emailError) {
        console.error('Resend email error /api/partner/pledges/[id]:', emailError);
      }

      return NextResponse.json({ success: true, status: 'accepted' });
    }

    if (action === 'fulfill') {
      if (pledge.status !== 'accepted') {
        return NextResponse.json(
          { error: 'Only accepted pledges can be fulfilled' },
          { status: 400 },
        );
      }

      if (!token || token !== pledge.qr_token) {
        return NextResponse.json(
          { error: 'Invalid verification token' },
          { status: 400 },
        );
      }

      const { error: updateError } = await supabase
        .from('pledges')
        .update({
          status: 'fulfilled',
          fulfilled_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to fulfill pledge' },
          { status: 500 },
        );
      }

      const { error: itemsError } = await supabase
        .from('clothes')
        .update({ status: pledge.action_type })
        .in('id', pledge.item_ids || []);

      if (itemsError) {
        console.error('Supabase items update error:', itemsError);
      }

      const emailHtml = await render(
        <PledgeFulfilled
          userName={userName}
          partnerName={partnerData.name}
          partnerType={pledge.action_type as 'donate' | 'sell' | 'recycle'}
          items={items}
          pledgeId={id}
        />,
      );

      const { error: emailError } = await resend.emails.send({
        from: 'Outfitr <onboarding@resend.dev>',
        to: userData.email,
        subject: `Your ${pledge.action_type} has been confirmed!`,
        html: emailHtml,
      });

      if (emailError) {
        console.error('Resend email error /api/partner/pledges/[id]:', emailError);
      }

      return NextResponse.json({ success: true, status: 'fulfilled' });
    }

    if (action === 'reject') {
      const { error: updateError } = await supabase
        .from('pledges')
        .update({
          status: 'rejected',
          rejection_reason: rejection_reason || null,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to reject pledge' },
          { status: 500 },
        );
      }

      const emailHtml = await render(
        <PledgeRejected
          userName={userName}
          partnerName={partnerData.name}
          partnerType={pledge.action_type as 'donate' | 'sell' | 'recycle'}
          items={items}
          pledgeId={id}
          rejectionReason={rejection_reason}
        />,
      );

      const { error: emailError } = await resend.emails.send({
        from: 'Outfitr <onboarding@resend.dev>',
        to: userData.email,
        subject: `Your ${pledge.action_type} request has been reviewed`,
        html: emailHtml,
      });

      if (emailError) {
        console.error('Resend email error /api/partner/pledges/[id]:', emailError);
      }

      return NextResponse.json({ success: true, status: 'rejected' });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 },
    );
  } catch (err) {
    console.error('API /api/partner/pledges/[id] crashed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
