import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;

    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse multipart form
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 3. Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max size is ${MAX_FILE_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    // 4. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    // 5. Validate extension matches MIME type
    const ext = file.name.split(".").pop()?.toLowerCase();
    const expectedExts: Record<string, string[]> = {
      "image/jpeg": ["jpg", "jpeg"],
      "image/jpg": ["jpg", "jpeg"],
      "image/png": ["png"],
      "image/webp": ["webp"],
    };
    const validExts = expectedExts[file.type];
    if (!ext || !validExts?.includes(ext)) {
      return NextResponse.json(
        { error: "File extension does not match its content type." },
        { status: 400 }
      );
    }

    // 6. Sanitize filename
    const safeExt = ext || "jpg";
    const fileName = `clothes/${user_id}/${Date.now()}.${safeExt}`;

    // 7. Upload to Supabase Storage
    const { error } = await supabase.storage
      .from("clothes-images")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const publicUrl = supabase.storage
      .from("clothes-images")
      .getPublicUrl(fileName);

    return NextResponse.json({ url: publicUrl.data.publicUrl });
  } catch (err) {
    console.error("API /api/upload crashed:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
