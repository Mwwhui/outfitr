import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json({ materials: [] });
  }

  try {
    const { data, error } = await supabase
      .from("clothes")
      .select("material")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .neq("material", "")
      .not("material", "is", null);

    if (error) {
      console.error("Supabase error /api/materials:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    const materials = [...new Set(data.map((item) => item.material))].sort();

    return NextResponse.json({ materials });
  } catch (err) {
    console.error("API /api/materials crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
