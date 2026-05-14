import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // Get current logged-in user
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ connected: false });
  }

  const userId = session.user.id;

  // Scenario 1:
  // User logged in WITH Google and has calendar token in JWT
  const hasTokenFromGoogleLogin = Boolean((session as any)?.googleAccessToken);

  if (hasTokenFromGoogleLogin) {
    return NextResponse.json({
      connected: true,
      via: 'google-login',
    });
  }

  // Scenario 2:
  // User logged in with credentials, but linked Google Calendar separately
  const { data, error } = await supabase
    .from('google_calendar_integrations')
    .select('google_email')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Google integration status error:', error);
    return NextResponse.json({ connected: false });
  }

  if (data) {
    return NextResponse.json({
      connected: true,
      via: 'linked',
      googleEmail: data.google_email,
    });
  }

  // Not connected
  return NextResponse.json({ connected: false });
}
