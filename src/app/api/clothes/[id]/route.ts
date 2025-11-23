// app/api/clothes/[id]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = supabaseServer();
  const { id } = await params;

  const { data, error } = await supabase
    .from("clothes")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json(data);
}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = supabaseServer();
  const { id } = await params;
  const body = await req.json();

  const { data, error } = await supabase
    .from("clothes")
    .update({
      ...body,
      updated_at: new Date(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json(data);
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = supabaseServer();
  const { id } = await params;

  // Soft delete, update deleted_at timestamp
  const { error } = await supabase
    .from("clothes")
    .update({ deleted_at: new Date() })
    .eq("id", id);

  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ success: true });
}
