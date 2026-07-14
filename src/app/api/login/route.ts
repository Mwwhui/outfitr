import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

// Initialize Supabase client (server-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Columns to return to the client — NEVER include password_hash
const SAFE_USER_COLUMNS = [
  'id',
  'email',
  'username',
  'first_name',
  'last_name',
  'role',
  'partner_id',
  'created_at',
  'updated_at',
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 },
      );
    }

    // Fetch user from Supabase users table
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error) {
      console.error('Supabase login error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }

    const user = users?.[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 },
      );
    }

    // Strip password_hash before returning
    const safeUser: Record<string, any> = {};
    for (const key of SAFE_USER_COLUMNS) {
      if (key in user) {
        safeUser[key] = user[key];
      }
    }

    return NextResponse.json(
      { message: 'Login successful!', user: safeUser },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('API /api/login crashed:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
