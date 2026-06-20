import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json({ brands: [] });
  }

  try {
    const { data, error } = await supabase
      .from("clothes")
      .select("brand")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .neq("brand", "")
      .not("brand", "is", null);

    if (error) {
      console.error("Supabase error /api/brands:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    const brands = [...new Set(data.map((item) => item.brand))].sort();

    return NextResponse.json({ brands });
  } catch (err) {
    console.error("API /api/brands crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
