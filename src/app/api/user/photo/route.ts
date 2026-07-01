import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `users/${session.user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("user-photos")
      .upload(fileName, file, {
        contentType: file.type,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const publicUrl = supabase.storage
      .from("user-photos")
      .getPublicUrl(fileName);

    const url = publicUrl.data.publicUrl;

    const serverClient = supabaseServer();
    const { error: dbError } = await serverClient
      .from("users")
      .update({ profile_image_url: url })
      .eq("id", session.user.id);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload photo error:", err);
    return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 });
  }
}
