import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Reset token is required" }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const { data: tokenRecord } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used")
      .eq("token_hash", tokenHash)
      .single();

    if (!tokenRecord) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    if (tokenRecord.used) {
      return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: "This reset link has expired" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", tokenRecord.user_id);

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
    }

    await supabase
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("id", tokenRecord.id);

    return NextResponse.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
