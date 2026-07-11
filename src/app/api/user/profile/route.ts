import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase/server";
import bcrypt from "bcrypt";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("users")
      .select("id, username, email, first_name, last_name, dob, nationality, gender, contact_no, password_hash, role, created_at, updated_at")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { password_hash, ...safeUser } = data;
    return NextResponse.json({ user: safeUser, has_password: !!password_hash });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const allowedFields = ["username", "first_name", "last_name", "dob", "nationality", "gender", "contact_no"];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const supabase = supabaseServer();

    // Handle password change/set
    if (body.password_change) {
      const { current_password, new_password } = body.password_change;

      if (!new_password || new_password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }

      const { data: user, error: fetchError } = await supabase
        .from("users")
        .select("password_hash")
        .eq("id", session.user.id)
        .single();

      if (fetchError || !user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // User has a password → must verify current one
      if (user.password_hash) {
        if (!current_password) {
          return NextResponse.json({ error: "Current password is required" }, { status: 400 });
        }
        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) {
          return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
        }
      }
      // User has no password (Google-registered) → setting one for the first time

      updates.password_hash = await bcrypt.hash(new_password, 10);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", session.user.id)
      .select("id, username, email, first_name, last_name, dob, nationality, gender, contact_no, role, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data, message: body.password_change ? "Password changed successfully!" : "Profile updated successfully!" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
