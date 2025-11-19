import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/clothes
export async function GET(req: Request) {
  const supabase = supabaseServer();

  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  const query = supabase
    .from("clothes")
    .select("*")
    .is("deleted_at", null) // ignore soft-deleted
    .order("created_at", { ascending: false });

  if (user_id) query.eq("user_id", user_id);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json(data);
}

// POST /api/clothes
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();

  const { data, error } = await supabase
    .from("clothes")
    .insert({
      user_id: body.user_id,
      name: body.name,
      type: body.type,
      color: body.color,
      season: body.season,
      size: body.size,
      brand: body.brand,
      price: body.price,
      material: body.material,
      favorite: body.favorite,
      image_url: body.image_url,
      categories: body.categories,
      description: body.description,
      purchase_date: body.purchase_date,
      location: body.location,
      notes: body.notes,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
