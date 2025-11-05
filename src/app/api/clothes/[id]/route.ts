import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServer();
  const body = await req.json();

  const { data, error } = await supabase
    .from("clothes")
    .update({
      ...body,
      updated_at: new Date(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServer();

  // Soft delete, update deleted_at timestamp
  const { data, error } = await supabase
    .from("clothes")
    .update({ deleted_at: new Date() })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ success: true });
}
