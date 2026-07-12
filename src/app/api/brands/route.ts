import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

// GET /api/brands — list authenticated user's unique brands
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
      .select("brand")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .neq("brand", "")
      .not("brand", "is", null);

    if (error) {
      console.error("Supabase error /api/brands:", error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const brands = [...new Set(data.map((item) => item.brand))].sort();

    return NextResponse.json({ brands });
  } catch (err) {
    console.error("API /api/brands crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
