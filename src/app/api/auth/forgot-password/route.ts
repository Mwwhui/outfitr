/*
  Run this in Supabase SQL editor before using this endpoint:

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
*/

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { resend } from "@/lib/resend";
import { render } from "react-email";
import crypto from "crypto";
import PasswordReset from "@/emails/password-reset";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, email, first_name")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (!user) {
      // Don't reveal whether the email exists
      return NextResponse.json({
        message: "If an account with that email exists, a reset link has been sent.",
      });
    }

    // Clean up old tokens for this user
    await supabase
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", user.id);

    // Generate token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Failed to store reset token:", insertError);
      return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
    }

    const resetLink = `${APP_URL}/auth/reset-password?token=${rawToken}`;
    const userName = user.first_name || "there";

    const emailHtml = await render(
      createElement(PasswordReset, { userName, resetLink })
    );

    const { error: emailError } = await resend.emails.send({
      from: "Outfitr <onboarding@resend.dev>",
      to: user.email,
      subject: "Reset your Outfitr password",
      html: emailHtml,
    });

    if (emailError) {
      console.error("Failed to send reset email:", emailError);
    }

    return NextResponse.json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
