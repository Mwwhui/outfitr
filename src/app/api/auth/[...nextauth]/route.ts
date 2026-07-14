import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing credentials');
        }

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', credentials.email)
          .single();

        if (error || !data) {
          throw new Error('Invalid email or password');
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          data.password_hash,
        );

        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: data.id,
          email: data.email,
          name: `${data.first_name} ${data.last_name}`,
          role: data.role || 'user',
          partner_id: data.partner_id || null,
        };
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.readonly',
          ].join(' '),
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],

  session: {
    strategy: 'jwt',
  },

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: '/auth/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      // Only handle Google sign-in here
      if (account?.provider !== 'google') return true;

      if (!user.email) return false;

      const email = user.email;
      const fullName = user.name || '';
      const parts = fullName.trim().split(' ');
      const first_name = parts[0] || 'User';
      const last_name = parts.slice(1).join(' ') || '';

      const base =
        email
          .split('@')[0]
          .replace(/[^a-zA-Z0-9_]/g, '')
          .slice(0, 16) || 'user';
      const suffix = Math.random().toString(36).slice(2, 6);
      const username = `${base}_${suffix}`;

      // Check if user exists in your Supabase "users" table
      const { data: existing, error: findErr } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (findErr) {
        console.error('Supabase lookup error:', findErr);
        return false;
      }

      // If not exists, insert
      if (!existing) {
        const { error: insertErr } = await supabase.from('users').insert({
          username,
          email,
          first_name,
          last_name,
          password_hash: null,
        });

        if (insertErr) {
          console.error('Supabase insert error:', insertErr);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      // existing logic (keep)
      if (user) {
        token.email = user.email;
        token.name = user.name;
      }

      // store Google token for Calendar
      if (account?.provider === 'google') {
        token.googleAccessToken = account.access_token;
        token.googleRefreshToken = account.refresh_token;
        token.googleAccessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : undefined;
      }

      // fetch DB user id, role, partner_id
      // Only query DB when token doesn't already have id (first login / new token)
      if (token.email && !token.id) {
        const { data } = await supabase
          .from('users')
          .select('id, role, partner_id')
          .eq('email', token.email)
          .maybeSingle();

        if (data) {
          token.id = data.id;
          token.role = data.role || 'user';
          token.partner_id = data.partner_id || null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        email: token.email as string,
        name: token.name as string,
        role: token.role as string,
        partner_id: token.partner_id as string | null,
      };

      (session as any).googleAccessToken = token.googleAccessToken;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
