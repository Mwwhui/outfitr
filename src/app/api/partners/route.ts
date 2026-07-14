import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const VALID_TYPES = ["donate", "sell", "recycle"] as const;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);

  const type = searchParams.get("type");
  if (type && !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return NextResponse.json(
      { error: "Invalid type. Must be donate, sell, or recycle." },
      { status: 400 },
    );
  }

  const search = searchParams.get("search");
  if (search !== null && search.length < 2) {
    return NextResponse.json(
      { error: "Search must be at least 2 characters." },
      { status: 400 },
    );
  }

  let limit = 50;
  let offset = 0;

  const limitParam = searchParams.get("limit");
  if (limitParam !== null) {
    const parsed = parseInt(limitParam, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json(
        { error: "Limit must be an integer between 1 and 100." },
        { status: 400 },
      );
    }
    limit = parsed;
  }

  const offsetParam = searchParams.get("offset");
  if (offsetParam !== null) {
    const parsed = parseInt(offsetParam, 10);
    if (isNaN(parsed) || parsed < 0) {
      return NextResponse.json(
        { error: "Offset must be a non-negative integer." },
        { status: 400 },
      );
    }
    offset = parsed;
  }

  try {
    let query = supabase
      .from("partners")
      .select("*")
      .order("name", { ascending: true });

    if (type) {
      query = query.eq("type", type);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,address.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error /api/partners:", error);
      return NextResponse.json(
        { error: "Failed to fetch partners" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("API /api/partners crashed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 },
  );
}
