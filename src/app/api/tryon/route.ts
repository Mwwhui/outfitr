import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const inMemoryCache = new Map<string, { url: string; ts: number }>();
const IN_MEMORY_TTL = 60 * 60 * 1000;

const MONTHLY_LIMIT = 12;

function daysUntilNextMonth(): number {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function buildPrompt(items: Array<{ color?: string; type: string }>): string {
  return items
    .map((item, i) => `the ${item.color || ""} ${item.type} from image ${i + 1}`)
    .join(" and ");
}

async function persistImage(imageUrl: string, userId: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Failed to fetch result image");
  const buffer = Buffer.from(await res.arrayBuffer());
  const fileName = `tryon/${userId}/${Date.now()}.png`;

  const { error } = await supabase.storage
    .from("tryon-results")
    .upload(fileName, buffer, { contentType: "image/png" });

  if (error) throw new Error(error.message);

  return supabase.storage.from("tryon-results").getPublicUrl(fileName).data.publicUrl;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { garmentIds, slots: clientSlots } = body as {
      garmentIds: string[];
      slots?: Record<string, { id: string; name: string; type: string; image_url?: string; color?: string } | null>;
    };

    if (!garmentIds || !Array.isArray(garmentIds) || garmentIds.length === 0) {
      return NextResponse.json({ error: "garmentIds is required" }, { status: 400 });
    }

    const serverClient = supabaseServer();

    // Fetch user
    const { data: userRow, error: userError } = await serverClient
      .from("users")
      .select("profile_image_url, try_on_count, try_on_reset_at")
      .eq("id", userId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const profileImageUrl = userRow.profile_image_url;
    if (!profileImageUrl) {
      return NextResponse.json(
        { error: "Upload a full-body photo first" },
        { status: 400 },
      );
    }

    // Rate limit check
    const now = new Date();
    const resetDate = userRow.try_on_reset_at ? new Date(userRow.try_on_reset_at) : new Date();
    let currentCount = userRow.try_on_count || 0;

    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      currentCount = 0;
      await serverClient
        .from("users")
        .update({ try_on_count: 0, try_on_reset_at: now.toISOString().slice(0, 10) })
        .eq("id", userId);
    }

    if (currentCount >= MONTHLY_LIMIT) {
      return NextResponse.json(
        {
          error: "Monthly try-on limit reached",
          rateLimited: true,
          remaining: 0,
          resetsInDays: daysUntilNextMonth(),
        },
        { status: 429 },
      );
    }

    // Fetch garments
    const { data: garments, error: garmentError } = await serverClient
      .from("clothes")
      .select("id, image_url, type, name, color")
      .in("id", garmentIds)
      .eq("user_id", userId);

    if (garmentError) {
      return NextResponse.json({ error: garmentError.message }, { status: 500 });
    }

    if (!garments || garments.length === 0) {
      return NextResponse.json({ error: "Garments not found" }, { status: 404 });
    }

    // Build garment list from client slots (preserves slot ordering)
    const garmentsToTry: Array<{ id: string; name: string; type: string; image_url?: string; color?: string }> = [];

    if (clientSlots) {
      const slotOrder = ["onepiece", "top", "bottom", "outerwear"];
      for (const slotKey of slotOrder) {
        const slot = clientSlots[slotKey];
        if (!slot || !slot.image_url) continue;
        garmentsToTry.push({
          id: slot.id,
          name: slot.name,
          type: slot.type,
          image_url: slot.image_url,
          color: slot.color,
        });
      }
    } else {
      for (const g of garments) {
        if (g.image_url) garmentsToTry.push(g);
      }
    }

    if (garmentsToTry.length === 0) {
      return NextResponse.json(
        { error: "Selected items have no photos" },
        { status: 400 },
      );
    }

    // Check cache
    const garmentHash = [...garmentIds].sort().join(",");

    const memKey = `${userId}::${garmentHash}::${profileImageUrl}`;
    const memCached = inMemoryCache.get(memKey);
    if (memCached && Date.now() - memCached.ts < IN_MEMORY_TTL) {
      return NextResponse.json({
        url: memCached.url,
        cached: true,
        remaining: MONTHLY_LIMIT - currentCount,
        resetsInDays: daysUntilNextMonth(),
        garmentNames: garmentsToTry.map((g) => g.name),
      });
    }

    const { data: cached } = await serverClient
      .from("tryon_cache")
      .select("result_url")
      .eq("user_id", userId)
      .eq("garment_hash", garmentHash)
      .eq("profile_image_url", profileImageUrl)
      .single();

    if (cached?.result_url) {
      inMemoryCache.set(memKey, { url: cached.result_url, ts: Date.now() });
      return NextResponse.json({
        url: cached.result_url,
        cached: true,
        remaining: MONTHLY_LIMIT - currentCount,
        resetsInDays: daysUntilNextMonth(),
        garmentNames: garmentsToTry.map((g) => g.name),
      });
    }

    // Build Replicate input
    const garmentImages = garmentsToTry.map((g) => g.image_url).filter(Boolean) as string[];
    const prompt = buildPrompt(garmentsToTry);

    const input: Record<string, unknown> = {
      person_image: profileImageUrl,
      garment_images: garmentImages,
      preserve_input_size: true,
      turbo: true,
    };

    if (prompt) {
      input.prompt = prompt;
    }

    // Call Replicate API directly (bypasses SDK file-detection issues)
    const replicateToken = process.env.REPLICATE_API_TOKEN!;
    const modelVersion = "0e122964dd5d7fce695da14e9206f8dd48c0c5595ecb7e3cf1a4078701fb2665";

    const createRes = await fetch(
      "https://api.replicate.com/v1/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version: modelVersion, input }),
      },
    );

    if (!createRes.ok) {
      const errBody = await createRes.text();
      throw new Error(`Replicate create failed: ${createRes.status} ${errBody}`);
    }

    const prediction = await createRes.json();

    // Poll until complete (max 120s)
    const pollStart = Date.now();
    const POLL_TIMEOUT = 120_000;
    let current = prediction;

    while (current.status !== "succeeded" && current.status !== "failed") {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(prediction.urls.get, {
        headers: { Authorization: `Bearer ${replicateToken}` },
      });
      current = await pollRes.json();

      if (Date.now() - pollStart > POLL_TIMEOUT) {
        throw new Error("Replicate prediction timed out (120s)");
      }
    }

    if (current.status === "failed") {
      throw new Error(current.error || "Replicate prediction failed");
    }

    const rawOutput = current.output;

    let tempUrl: string;
    if (Array.isArray(rawOutput) && rawOutput.length > 0) {
      tempUrl = String(rawOutput[0]);
    } else if (typeof rawOutput === "string") {
      tempUrl = rawOutput;
    } else {
      return NextResponse.json({ error: "Unexpected output format from Replicate" }, { status: 502 });
    }

    // Persist to Supabase
    const resultUrl = await persistImage(tempUrl, userId);

    // Update cache
    inMemoryCache.set(memKey, { url: resultUrl, ts: Date.now() });

    await serverClient
      .from("tryon_cache")
      .upsert(
        {
          user_id: userId,
          garment_hash: garmentHash,
          result_url: resultUrl,
          profile_image_url: profileImageUrl,
          garment_count: garmentsToTry.length,
        },
        { onConflict: "user_id,garment_hash,profile_image_url" },
      );

    // Increment try-on count
    await serverClient
      .from("users")
      .update({ try_on_count: currentCount + 1 })
      .eq("id", userId);

    return NextResponse.json({
      url: resultUrl,
      cached: false,
      remaining: MONTHLY_LIMIT - (currentCount + 1),
      resetsInDays: daysUntilNextMonth(),
      garmentNames: garmentsToTry.map((g) => g.name),
    });
  } catch (error) {
    console.error("API /api/tryon crashed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const garmentIdsParam = searchParams.get("garmentIds");
    if (!garmentIdsParam) {
      return NextResponse.json(
        { error: "garmentIds query param is required" },
        { status: 400 },
      );
    }

    const garmentIds = garmentIdsParam.split(",").filter(Boolean);
    const garmentHash = [...garmentIds].sort().join(",");

    const serverClient = supabaseServer();

    const { data: userRow } = await serverClient
      .from("users")
      .select("profile_image_url, try_on_count, try_on_reset_at")
      .eq("id", session.user.id)
      .single();

    if (!userRow?.profile_image_url) {
      return NextResponse.json({ error: "No profile photo" }, { status: 404 });
    }

    const memKey = `${session.user.id}::${garmentHash}::${userRow.profile_image_url}`;

    // Compute remaining count
    const now = new Date();
    const resetDate = userRow.try_on_reset_at ? new Date(userRow.try_on_reset_at) : new Date();
    let currentCount = userRow.try_on_count || 0;
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      currentCount = 0;
    }
    const remaining = MONTHLY_LIMIT - currentCount;
    const resetsInDays = daysUntilNextMonth();

    const memCached = inMemoryCache.get(memKey);
    if (memCached && Date.now() - memCached.ts < IN_MEMORY_TTL) {
      return NextResponse.json({ url: memCached.url, cached: true, remaining, resetsInDays });
    }

    const { data: cached } = await serverClient
      .from("tryon_cache")
      .select("result_url")
      .eq("user_id", session.user.id)
      .eq("garment_hash", garmentHash)
      .eq("profile_image_url", userRow.profile_image_url)
      .single();

    if (cached?.result_url) {
      inMemoryCache.set(memKey, { url: cached.result_url, ts: Date.now() });
      return NextResponse.json({ url: cached.result_url, cached: true, remaining, resetsInDays });
    }

    return NextResponse.json({ cached: false, remaining, resetsInDays });
  } catch (error) {
    console.error("API /api/tryon GET crashed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 },
    );
  }
}
