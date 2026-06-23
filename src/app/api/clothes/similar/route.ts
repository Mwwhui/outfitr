import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { normalizeColor, colorSimilarity } from "@/lib/colorNorm";

interface SimilarItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
  similarity: number;
}

// GET /api/clothes/similar?user_id=X&type=Tops&color=Navy+Blue&exclude_id=Y
export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");
  const type = searchParams.get("type");
  const color = searchParams.get("color");
  const exclude_id = searchParams.get("exclude_id");

  if (!user_id || !type) {
    return NextResponse.json(
      { error: "user_id and type are required" },
      { status: 400 },
    );
  }

  try {
    // Fetch all user items of the same type (cheap query, no color filter yet)
    let query = supabase
      .from("clothes")
      .select("id, name, type, color, image_url")
      .eq("user_id", user_id)
      .eq("type", type)
      .is("deleted_at", null)
      .eq("status", "available");

    if (exclude_id) {
      query = query.neq("id", exclude_id);
    }

    const { data: items, error } = await query;

    if (error) {
      console.error("Supabase error /api/clothes/similar:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ similar: [], count: 0 });
    }

    // Score each item by color similarity
    const scored: SimilarItem[] = items
      .map((item) => {
        const sim = color
          ? colorSimilarity(color, item.color || "")
          : 0;
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          color: item.color,
          image_url: item.image_url,
          similarity: sim,
        };
      })
      .filter((item) => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      similar: scored,
      count: scored.length,
    });
  } catch (err) {
    console.error("API /api/clothes/similar crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
