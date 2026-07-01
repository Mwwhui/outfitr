import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { Client } from "@gradio/client";

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const inMemoryCache = new Map<string, { url: string; ts: number }>();
const IN_MEMORY_TTL = 60 * 60 * 1000;

const LEFFA_SPACE = "franciszzj/Leffa";

interface GarmentQueueItem {
  id: string;
  name: string;
  imageUrl: string;
  modelType: "viton_hd" | "dress_code";
  garmentType: "upper_body" | "lower_body" | "dresses";
}

const SLOT_LEFFA_MAP: Record<string, { modelType: "viton_hd" | "dress_code"; garmentType: "upper_body" | "lower_body" | "dresses" }> = {
  onepiece: { modelType: "dress_code", garmentType: "dresses" },
  bottom: { modelType: "dress_code", garmentType: "lower_body" },
  top: { modelType: "viton_hd", garmentType: "upper_body" },
  outerwear: { modelType: "viton_hd", garmentType: "upper_body" },
};

const CHAIN_ORDER: (keyof typeof SLOT_LEFFA_MAP)[] = ["onepiece", "bottom", "top", "outerwear"];

async function urlToFile(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

async function callLeffa(
  app: Client,
  personImageUrl: string,
  garmentImageUrl: string,
  modelType: "viton_hd" | "dress_code",
  garmentType: "upper_body" | "lower_body" | "dresses",
  seed: number,
  maxRetries = 2,
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const [personFile, garmentFile] = await Promise.all([
        urlToFile(personImageUrl, "person.jpg"),
        urlToFile(garmentImageUrl, "garment.jpg"),
      ]);

      const result = await app.predict("/leffa_predict_vt", {
        src_image_path: personFile,
        ref_image_path: garmentFile,
        ref_acceleration: false,
        step: 30,
        scale: 2.5,
        seed,
        vt_model_type: modelType,
        vt_garment_type: garmentType,
        vt_repaint: false,
      }) as { data: Array<{ url?: string; path?: string }> };

      const output = result.data?.[0];
      const url = output?.url || output?.path;
      if (!url) throw new Error("No image URL in Leffa response");
      return url;
    } catch (err) {
      console.error(`Leffa attempt ${attempt + 1} failed:`, err);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 3000 * Math.pow(2, attempt)));
      } else {
        throw err;
      }
    }
  }
  throw new Error("unreachable");
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

async function persistIntermediateImage(imageUrl: string, userId: string, step: number): Promise<{ url: string; path: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Failed to fetch intermediate image");
  const buffer = Buffer.from(await res.arrayBuffer());
  const fileName = `temp/${userId}/${Date.now()}-${step}.png`;

  const { error } = await supabase.storage
    .from("tryon-results")
    .upload(fileName, buffer, { contentType: "image/png" });

  if (error) throw new Error(error.message);

  const url = supabase.storage.from("tryon-results").getPublicUrl(fileName).data.publicUrl;
  return { url, path: fileName };
}

async function cleanupTempFiles(paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage
    .from("tryon-results")
    .remove(paths)
    .catch(() => {});
}

export async function POST(req: Request) {
  const tempPaths: string[] = [];
  let gradioApp: Client | null = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { garmentIds, seed, slots: clientSlots } = body as {
      garmentIds: string[];
      seed?: number;
      slots?: Record<string, { id: string; name: string; type: string; image_url?: string } | null>;
    };

    if (!garmentIds || !Array.isArray(garmentIds) || garmentIds.length === 0) {
      return NextResponse.json({ error: "garmentIds is required" }, { status: 400 });
    }

    const serverClient = supabaseServer();

    const { data: userRow, error: userError } = await serverClient
      .from("users")
      .select("profile_image_url")
      .eq("id", session.user.id)
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

    const { data: garments, error: garmentError } = await serverClient
      .from("clothes")
      .select("id, image_url, type, name")
      .in("id", garmentIds)
      .eq("user_id", session.user.id);

    if (garmentError) {
      return NextResponse.json({ error: garmentError.message }, { status: 500 });
    }

    const garmentMap = new Map<string, { id: string; name: string; type: string; image_url?: string }>();
    for (const g of garments || []) {
      garmentMap.set(g.id, g);
    }

    const queue: GarmentQueueItem[] = [];

    if (clientSlots) {
      for (const slotKey of CHAIN_ORDER) {
        const slot = clientSlots[slotKey];
        if (!slot || !slot.image_url) continue;
        const leffa = SLOT_LEFFA_MAP[slotKey];
        if (!leffa) continue;
        queue.push({
          id: slot.id,
          name: slot.name,
          imageUrl: slot.image_url,
          modelType: leffa.modelType,
          garmentType: leffa.garmentType,
        });
      }
    } else {
      for (const g of garments || []) {
        if (!g.image_url) continue;
        const slotKey = (Object.keys(SLOT_LEFFA_MAP) as string[]).find(
          (k) => g.type?.toLowerCase().includes(k) || g.type?.toLowerCase().includes(
            k === "onepiece" ? "one" : k === "bottom" ? "bottom" : k === "top" ? "top" : "outer",
          ),
        );
        const leffa = slotKey ? SLOT_LEFFA_MAP[slotKey] : { modelType: "viton_hd" as const, garmentType: "upper_body" as const };
        queue.push({
          id: g.id,
          name: g.name,
          imageUrl: g.image_url,
          modelType: leffa.modelType,
          garmentType: leffa.garmentType,
        });
      }
    }

    if (queue.length === 0) {
      return NextResponse.json(
        { error: "Selected items have no photos" },
        { status: 400 },
      );
    }

    const garmentHash = [...garmentIds].sort().join(",");
    const useSeed = seed ?? 42;

    if (seed === undefined) {
      const memKey = `${session.user.id}::${garmentHash}::${profileImageUrl}`;
      const memCached = inMemoryCache.get(memKey);
      if (memCached && Date.now() - memCached.ts < IN_MEMORY_TTL) {
        return NextResponse.json({
          url: memCached.url,
          cached: true,
          garmentNames: queue.map((q) => q.name),
        });
      }

      const { data: cached } = await serverClient
        .from("tryon_cache")
        .select("result_url")
        .eq("user_id", session.user.id)
        .eq("garment_hash", garmentHash)
        .eq("profile_image_url", profileImageUrl)
        .single();

      if (cached?.result_url) {
        inMemoryCache.set(memKey, { url: cached.result_url, ts: Date.now() });
        return NextResponse.json({
          url: cached.result_url,
          cached: true,
          garmentNames: queue.map((q) => q.name),
        });
      }
    }

    const hfToken = process.env.HF_TOKEN as `hf_${string}` | undefined;
    gradioApp = await Client.connect(LEFFA_SPACE, hfToken ? { token: hfToken } : {});

    let currentPersonUrl = profileImageUrl;
    const stepResults: { name: string; success: boolean }[] = [];

    for (let i = 0; i < queue.length; i++) {
      const garment = queue[i];
      try {
        const leffaUrl = await callLeffa(
          gradioApp!,
          currentPersonUrl,
          garment.imageUrl,
          garment.modelType,
          garment.garmentType,
          useSeed + i,
        );
        const stable = await persistIntermediateImage(leffaUrl, session.user.id, i);
        currentPersonUrl = stable.url;
        tempPaths.push(stable.path);
        stepResults.push({ name: garment.name, success: true });
      } catch (err) {
        console.error(`Chain step ${i + 1} failed for "${garment.name}":`, err);
        stepResults.push({ name: garment.name, success: false });
        if (i === 0) {
          return NextResponse.json(
            { error: `Failed to generate try-on. The AI model may be busy — please try again.` },
            { status: 502 },
          );
        }
        break;
      }
    }

    const allSucceeded = stepResults.every((s) => s.success);
    let resultUrl: string;
    try {
      resultUrl = await persistImage(currentPersonUrl, session.user.id);
    } catch {
      resultUrl = currentPersonUrl;
    }

    if (seed === undefined || allSucceeded) {
      const memKey = `${session.user.id}::${garmentHash}::${profileImageUrl}`;
      inMemoryCache.set(memKey, { url: resultUrl, ts: Date.now() });

      await serverClient
        .from("tryon_cache")
        .upsert(
          {
            user_id: session.user.id,
            garment_hash: garmentHash,
            result_url: resultUrl,
            profile_image_url: profileImageUrl,
            garment_count: queue.length,
            seed: useSeed,
          },
          { onConflict: "user_id,garment_hash,profile_image_url" },
        );
    }

    if (tempPaths.length > 0) {
      void cleanupTempFiles(tempPaths);
    }

    return NextResponse.json({
      url: resultUrl,
      cached: false,
      garmentNames: queue.map((q) => q.name),
      partial: !allSucceeded,
      stepResults,
    });
  } catch (error) {
    console.error("API /api/tryon crashed:", error);
    if (tempPaths.length > 0) {
      void cleanupTempFiles(tempPaths);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 },
    );
  } finally {
    if (gradioApp) {
      gradioApp.close();
    }
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
      .select("profile_image_url")
      .eq("id", session.user.id)
      .single();

    if (!userRow?.profile_image_url) {
      return NextResponse.json({ error: "No profile photo" }, { status: 404 });
    }

    const memKey = `${session.user.id}::${garmentHash}::${userRow.profile_image_url}`;
    const memCached = inMemoryCache.get(memKey);
    if (memCached && Date.now() - memCached.ts < IN_MEMORY_TTL) {
      return NextResponse.json({ url: memCached.url, cached: true });
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
      return NextResponse.json({ url: cached.result_url, cached: true });
    }

    return NextResponse.json({ error: "Not cached" }, { status: 404 });
  } catch (error) {
    console.error("API /api/tryon GET crashed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 },
    );
  }
}
