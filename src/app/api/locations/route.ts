import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

// GET /api/locations — list authenticated user's unique locations
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;

    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("clothes")
      .select("location")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .neq("location", "")
      .not("location", "is", null);

    if (error) {
      console.error("Supabase error /api/locations:", error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const locations = [...new Set(data.map((item) => item.location))].sort();

    return NextResponse.json({ locations });
  } catch (err) {
    console.error("API /api/locations crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
