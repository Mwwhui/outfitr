import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", credentials?.email)
          .single();

        if (error || !data) throw new Error("Invalid email or password");

        const isValid = await bcrypt.compare(
          credentials!.password,
          data.password_hash
        );

        if (!isValid) throw new Error("Invalid email or password");

        return {
          id: data.id,
          email: data.email,
          name: `${data.first_name} ${data.last_name}`,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/auth/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        email: token.email as string,
        name: token.name as string,
      };
      return session;
    },
  },
});

export { handler as GET, handler as POST };
