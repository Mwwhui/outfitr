import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type StoredIntegrationRow = {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null; // epoch seconds
  google_email: string | null;
};

function toDayRangeISO(dateStr: string, timeZone = 'Asia/Kuala_Lumpur') {
  // RFC3339 required format
  const timeMin = `${dateStr}T00:00:00Z`;
  const timeMax = `${dateStr}T23:59:59Z`;
  return { timeMin, timeMax, timeZone };
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to refresh token: ${txt}`);
  }

  const json: any = await res.json();
  const accessToken = json.access_token as string | undefined;
  const expiresIn = json.expires_in as number | undefined;

  if (!accessToken) throw new Error('No access_token in refresh response');

  const expiresAt = expiresIn
    ? Math.floor(Date.now() / 1000) + expiresIn
    : null;

  return { accessToken, expiresAt };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date'); // YYYY-MM-DD
  const calendarId = url.searchParams.get('calendarId') || 'primary';

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Missing or invalid date (expected YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // 1) Prefer token from Google login (Scenario 1)
  const sessionAccessToken = (session as any)?.googleAccessToken as
    | string
    | undefined;

  let accessToken: string | null = sessionAccessToken ?? null;

  // 2) If no session token, use linked integration (Scenario 2)
  let integrationRow: StoredIntegrationRow | null = null;

  if (!accessToken) {
    const { data, error } = await supabase
      .from('google_calendar_integrations')
      .select('user_id, access_token, refresh_token, expires_at, google_email')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to read integration row:', error);
      return NextResponse.json(
        { error: 'Failed to read integration status' },
        { status: 500 }
      );
    }

    integrationRow = (data as any) ?? null;

    if (!integrationRow?.access_token) {
      return NextResponse.json(
        { error: 'Google Calendar not connected' },
        { status: 403 }
      );
    }

    accessToken = integrationRow.access_token;
  }

  // 3) If using linked integration token, refresh when expired/near expiry
  if (integrationRow) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = integrationRow.expires_at;

    const needsRefresh =
      expiresAt !== null && expiresAt !== undefined && expiresAt <= now + 60; // refresh 60s early

    if (needsRefresh) {
      if (!integrationRow.refresh_token) {
        return NextResponse.json(
          {
            error:
              'Google token expired and no refresh token stored. Please reconnect.',
          },
          { status: 401 }
        );
      }

      try {
        const refreshed = await refreshAccessToken(
          integrationRow.refresh_token
        );
        accessToken = refreshed.accessToken;

        const { error: upErr } = await supabase
          .from('google_calendar_integrations')
          .update({
            access_token: refreshed.accessToken,
            expires_at: refreshed.expiresAt,
          })
          .eq('user_id', session.user.id);

        if (upErr) console.error('Failed to update refreshed token:', upErr);
      } catch (e) {
        console.error('Refresh token failed:', e);
        return NextResponse.json(
          { error: 'Failed to refresh Google token. Please reconnect.' },
          { status: 401 }
        );
      }
    }
  }

  // 4) Query Google Calendar API for events on that date
  const { timeMin, timeMax, timeZone } = toDayRangeISO(date);

  const gUrl = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events`
  );

  gUrl.searchParams.set('timeMin', timeMin);
  gUrl.searchParams.set('timeMax', timeMax);
  gUrl.searchParams.set('singleEvents', 'true');
  gUrl.searchParams.set('orderBy', 'startTime');
  gUrl.searchParams.set('timeZone', timeZone);
  gUrl.searchParams.set('maxResults', '50');
  gUrl.searchParams.set('showDeleted', 'false');

  const gRes = await fetch(gUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!gRes.ok) {
    const txt = await gRes.text();
    console.error('Google events API failed URL:', gUrl.toString());
    console.error('Google events API failed body:', txt);
    return NextResponse.json(
      { error: 'Failed to fetch Google Calendar events' },
      { status: 502 }
    );
  }

  const gJson: any = await gRes.json();
  const items: any[] = Array.isArray(gJson.items) ? gJson.items : [];

  const events = items
    .filter((ev) => ev?.status !== 'cancelled')
    .map((ev) => {
      const start = ev?.start?.dateTime ?? ev?.start?.date ?? null;
      const end = ev?.end?.dateTime ?? ev?.end?.date ?? null;

      return {
        id: ev.id as string,
        summary: (ev.summary as string) ?? '(No title)',
        location: (ev.location as string) ?? null,
        start,
        end,
        allDay: Boolean(ev?.start?.date && !ev?.start?.dateTime),
        htmlLink: (ev.htmlLink as string) ?? null,
      };
    });

  return NextResponse.json({ date, calendarId, events });
}
