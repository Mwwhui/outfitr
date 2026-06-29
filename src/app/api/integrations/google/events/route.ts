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
  expires_at: number | null;
  google_email: string | null;
};

function toDayRangeISO(dateStr: string, timeZone = 'Asia/Kuala_Lumpur') {
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

async function fetchGoogleEvents(accessToken: string, date: string, calendarId: string) {
  const { timeMin, timeMax, timeZone } = toDayRangeISO(date);

  const gUrl = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
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
    console.error('Google events API failed:', gRes.status, txt);
    return { ok: false, status: gRes.status, events: [] as any[] };
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

  return { ok: true, status: 200, events };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const calendarId = url.searchParams.get('calendarId') || 'primary';

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Missing or invalid date (expected YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // Always fetch linked integration row for fallback
  const { data: integrationData } = await supabase
    .from('google_calendar_integrations')
    .select('user_id, access_token, refresh_token, expires_at, google_email')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const integrationRow: StoredIntegrationRow | null = (integrationData as any) ?? null;

  // Try linked integration first (it has refresh logic)
  if (integrationRow?.access_token) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = integrationRow.expires_at;
    const needsRefresh = expiresAt !== null && expiresAt !== undefined && expiresAt <= now + 60;

    let linkedToken = integrationRow.access_token;

    if (needsRefresh && integrationRow.refresh_token) {
      try {
        const refreshed = await refreshAccessToken(integrationRow.refresh_token);
        linkedToken = refreshed.accessToken;

        await supabase
          .from('google_calendar_integrations')
          .update({ access_token: refreshed.accessToken, expires_at: refreshed.expiresAt })
          .eq('user_id', session.user.id);
      } catch (e) {
        console.error('Linked integration refresh failed:', e);
      }
    }

    const result = await fetchGoogleEvents(linkedToken, date, calendarId);
    if (result.ok) {
      return NextResponse.json({ date, calendarId, events: result.events });
    }
  }

  // Fallback to session token from Google login (Scenario 1)
  const sessionAccessToken = (session as any)?.googleAccessToken as string | undefined;

  if (sessionAccessToken) {
    const result = await fetchGoogleEvents(sessionAccessToken, date, calendarId);
    if (result.ok) {
      return NextResponse.json({ date, calendarId, events: result.events });
    }

    // Session token failed — return 401 so client can show reconnect prompt
    if (result.status === 401) {
      return NextResponse.json(
        { error: 'Google Calendar token expired', reconnect_url: '/api/integrations/google/start' },
        { status: 401 }
      );
    }
  }

  // Both sources failed — return 403 (not connected) or 401 (expired)
  if (!integrationRow && !sessionAccessToken) {
    return NextResponse.json(
      { error: 'Google Calendar not connected', reconnect_url: '/api/integrations/google/start' },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { error: 'Google Calendar token expired', reconnect_url: '/api/integrations/google/start' },
    { status: 401 }
  );
}
