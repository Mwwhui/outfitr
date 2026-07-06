import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import crypto from 'crypto';

const TOKEN_TTL = 365 * 24 * 60 * 60 * 1000;

function signToken(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET not configured');
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${hmac}`;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const user_id = session?.user?.id;
  if (!user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL).toISOString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = Buffer.from(`${user_id}|${expiresAt}|${nonce}`).toString('base64url');
  const token = signToken(payload);

  return NextResponse.json({ token, expires_at: expiresAt });
}

export async function GET() {
  return NextResponse.json({ token: null });
}
