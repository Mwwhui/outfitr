import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  // Must be logged in (credentials or google).
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL('/auth/login', process.env.NEXTAUTH_URL)
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL('/calendar?gcal=failed', process.env.NEXTAUTH_URL)
    );
  }

  // Read and clear cookies
  const jar = await cookies();
  const storedState = jar.get('gcal_state')?.value;
  const verifier = jar.get('gcal_verifier')?.value;

  jar.set('gcal_state', '', { path: '/', maxAge: 0 });
  jar.set('gcal_verifier', '', { path: '/', maxAge: 0 });

  if (!storedState || storedState !== state || !verifier) {
    return NextResponse.redirect(
      new URL('/calendar?gcal=state_mismatch', process.env.NEXTAUTH_URL)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL('/calendar?gcal=misconfigured', process.env.NEXTAUTH_URL)
    );
  }

  // Exchange code -> tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    console.error('Google token exchange failed:', await tokenRes.text());
    return NextResponse.redirect(
      new URL('/calendar?gcal=token_failed', process.env.NEXTAUTH_URL)
    );
  }

  const t: any = await tokenRes.json();
  const accessToken = t.access_token as string | undefined;
  const refreshToken = t.refresh_token as string | undefined;
  const expiresIn = t.expires_in as number | undefined;
  const scope = t.scope as string | undefined;

  if (!accessToken) {
    return NextResponse.redirect(
      new URL('/calendar?gcal=no_access', process.env.NEXTAUTH_URL)
    );
  }

  // expires_at in epoch seconds (store bigint)
  const expiresAt =
    typeof expiresIn === 'number'
      ? Math.floor(Date.now() / 1000) + expiresIn
      : null;

  let googleEmail: string | null = null;
  try {
    const meRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      googleEmail = me?.email ?? null;
    }
  } catch {
    // ignore
  }

  const userId = session.user.id;

  // Keep old refresh token if Google doesn't return a new one
  const { data: existing, error: existingErr } = await supabase
    .from('google_calendar_integrations')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingErr) {
    console.error('Supabase read integration error:', existingErr);
    return NextResponse.redirect(
      new URL('/calendar?gcal=db_read_failed', process.env.NEXTAUTH_URL)
    );
  }

  const payload = {
    user_id: userId,
    google_email: googleEmail,
    access_token: accessToken,
    refresh_token: refreshToken ?? existing?.refresh_token ?? null,
    expires_at: expiresAt,
    scope: scope ?? null,
  };

  const { error: upsertErr } = await supabase
    .from('google_calendar_integrations')
    .upsert(payload, { onConflict: 'user_id' });

  if (upsertErr) {
    console.error('Supabase upsert integration error:', upsertErr);
    return NextResponse.redirect(
      new URL('/calendar?gcal=db_write_failed', process.env.NEXTAUTH_URL)
    );
  }

  return NextResponse.redirect(
    new URL('/calendar?gcal=connected', process.env.NEXTAUTH_URL)
  );
}
