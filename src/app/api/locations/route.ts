import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json({ locations: [] });
  }

  try {
    const { data, error } = await supabase
      .from("clothes")
      .select("location")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .neq("location", "")
      .not("location", "is", null);

    if (error) {
      console.error("Supabase error /api/locations:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    const locations = [...new Set(data.map((item) => item.location))].sort();

    return NextResponse.json({ locations });
  } catch (err) {
    console.error("API /api/locations crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
