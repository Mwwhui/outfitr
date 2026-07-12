// app/api/clothes/[id]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

// Allowed fields for PATCH — prevents mass assignment
const ALLOWED_PATCH_FIELDS = [
  "name",
  "type",
  "color",
  "season",
  "size",
  "brand",
  "price",
  "material",
  "favorite",
  "image_url",
  "use_case",
  "description",
  "purchase_date",
  "location",
  "zone_id",
  "sort_order",
  "notes",
  "status",
];

async function verifyOwnership(
  supabase: ReturnType<typeof supabaseServer>,
  id: string,
  user_id: string
): Promise<{ ok: boolean; data?: any }> {
  const { data, error } = await supabase
    .from("clothes")
    .select("id, user_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return { ok: false };
  }

  if (data.user_id !== user_id) {
    return { ok: false };
  }

  return { ok: true, data };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;

    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { id } = await params;

    const { data, error } = await supabase
      .from("clothes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .single();

    if (error) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("API /api/clothes/[id] GET crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;

    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { id } = await params;
    const body = await req.json();

    // Verify ownership
    const { ok } = await verifyOwnership(supabase, id, user_id);
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build safe update payload from allowlist only
    const safeUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of ALLOWED_PATCH_FIELDS) {
      if (key in body) {
        safeUpdate[key] = body[key];
      }
    }

    const { data, error } = await supabase
      .from("clothes")
      .update(safeUpdate)
      .eq("id", id)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      console.error("Supabase error /api/clothes/[id] PATCH:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("API /api/clothes/[id] PATCH crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;

    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { id } = await params;

    // Verify ownership
    const { ok } = await verifyOwnership(supabase, id, user_id);
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete
    const { error } = await supabase
      .from("clothes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user_id);

    if (error) {
      console.error("Supabase error /api/clothes/[id] DELETE:", error);
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("API /api/clothes/[id] DELETE crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
