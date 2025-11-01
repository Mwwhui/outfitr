import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";

// Initialize Supabase client (server-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! 
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      username,
      email,
      password_hash,
      first_name,
      last_name,
      dob,
      nationality,
      gender,
      contact_no,
    } = body;

    // Basic validation
    if (!email || !password_hash || !username) {
      return NextResponse.json(
        { error: "Email, password and username are required." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password_hash, 10);

    // Insert user
    const { data, error } = await supabase.from("users").insert([
      { 
        username,
        email,
        password_hash: hashedPassword,
        first_name,
        last_name,
        dob,
        nationality,
        gender,
        contact_no,
      },
    ]);

    if (error) throw error;

    return NextResponse.json(
      { message: "User registered successfully!", data },
      { status: 201 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}