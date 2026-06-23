import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 30;

interface ComboItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
}

interface OutfitDNA {
  formula: string;
  color_habits: string[];
  strong_pairs: Array<{ item_a: string; item_b: string; count: number }>;
  never_tried: Array<{ item_a: string; item_b: string; reason: string }>;
  pattern_breakers: Array<{ combo: string[]; combo_items: ComboItem[]; reason: string }>;
  style_summary: string;
}

// In-memory cache with 7-day TTL
const DNA_CACHE = new Map<string, { data: OutfitDNA; ts: number }>();
const DNA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /api/outfits/dna
// Body: { user_id: string }
export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache first (7-day TTL)
    const cached = DNA_CACHE.get(user_id);
    if (cached && Date.now() - cached.ts < DNA_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = supabaseServer();

    // Fetch current valid item IDs
    const { data: currentItems } = await supabase
      .from("clothes")
      .select("id")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .or("status.is.null,status.eq.available");

    const validItemIds = new Set((currentItems || []).map((i) => i.id));

    // Fetch last 90 days of outfit plans
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const { data: plans } = await supabase
      .from("outfit_plans")
      .select("date, time_slot, slots")
      .eq("user_id", user_id)
      .gte("date", ninetyDaysAgo)
      .order("date", { ascending: false });

    if (!plans || plans.length < 3) {
      return NextResponse.json({
        formula: "Not enough data yet",
        color_habits: [],
        strong_pairs: [],
        never_tried: [],
        pattern_breakers: [],
        style_summary: "Wear more outfits to unlock your style DNA analysis.",
      });
    }

    // Build outfit history for Gemini (filter out deleted items)
    const outfitHistory = plans
      .map((plan) => {
        const items: Array<{ name: string; type: string; color: string }> = [];
        if (plan.slots && typeof plan.slots === "object") {
          for (const val of Object.values(plan.slots)) {
            if (val && typeof val === "object" && "id" in val) {
              const item = val as { id: string; name: string; type: string; color?: string };
              if (validItemIds.has(item.id)) {
                items.push({
                  name: item.name,
                  type: item.type,
                  color: item.color || "unknown",
                });
              }
            }
          }
        }
        return { date: plan.date, items };
      })
      .filter((entry) => entry.items.length >= 2); // Skip plans with <2 valid items

    // Also fetch all clothes for "never tried" analysis
    const { data: allClothes } = await supabase
      .from("clothes")
      .select("id, name, type, color, image_url")
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .or("status.is.null,status.eq.available");

    const wardrobeSummary = (allClothes || []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color || "unknown",
      image_url: c.image_url || null,
    }));

    const prompt = `You are a minimalist wardrobe analyst. Analyze this user's outfit history (last 90 days) and identify their STYLE DNA — the underlying patterns in what they combine.

OUTFIT HISTORY:
${JSON.stringify(outfitHistory.slice(0, 50))}

FULL WARDROBE (use the exact item names from this list):
${JSON.stringify(wardrobeSummary)}

Return ONLY valid JSON (no markdown, no extra text):
{
  "formula": "e.g. structured top + relaxed bottom + one neutral",
  "color_habits": ["e.g. dark tops with light bottoms", "earth tones for casual"],
  "strong_pairs": [{"item_a": "item name", "item_b": "item name", "count": N}],
  "never_tried": [{"item_a": "item name", "item_b": "item name", "reason": "would work because..."}],
  "pattern_breakers": [{"combo": ["exact item name 1", "exact item name 2"], "reason": "you always X but never Y"}],
  "style_summary": "2-3 sentence description of their style patterns and what makes it unique"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini DNA error:", errText);
      return NextResponse.json({ error: "Gemini API error" }, { status: response.status });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    let result: OutfitDNA;
    try {
      const jsonStr = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
      result = JSON.parse(jsonStr);
    } catch {
      result = {
        formula: "Could not analyze",
        color_habits: [],
        strong_pairs: [],
        never_tried: [],
        pattern_breakers: [],
        style_summary: text || "Could not parse AI response",
      };
    }

    // Resolve pattern_breaker item names to full ComboItem objects
    if (allClothes && result.pattern_breakers?.length > 0) {
      const nameToItem = new Map<string, ComboItem>();
      for (const c of allClothes) {
        nameToItem.set(c.name.toLowerCase(), {
          id: c.id,
          name: c.name,
          type: c.type,
          color: c.color || null,
          image_url: c.image_url || null,
        });
      }

      // Fuzzy match: try exact, then contains, then best overlap
      const findItem = (searchName: string): ComboItem | undefined => {
        const lower = searchName.toLowerCase();
        // Exact match
        if (nameToItem.has(lower)) return nameToItem.get(lower);
        // Contains match: "navy blazer" matches "Navy Blue Blazer"
        for (const [key, item] of nameToItem) {
          if (key.includes(lower) || lower.includes(key)) return item;
        }
        // Word overlap: "navy blazer" matches "Navy Casual Blazer"
        const searchWords = lower.split(/\s+/);
        let bestItem: ComboItem | undefined;
        let bestScore = 0;
        for (const [key, item] of nameToItem) {
          const keyWords = key.split(/\s+/);
          const overlap = searchWords.filter((w) => keyWords.some((kw) => kw.includes(w) || w.includes(kw))).length;
          if (overlap > bestScore) {
            bestScore = overlap;
            bestItem = item;
          }
        }
        return bestScore > 0 ? bestItem : undefined;
      };

      result.pattern_breakers = result.pattern_breakers.map((pb) => ({
        ...pb,
        combo_items: pb.combo
          .map((name) => findItem(name))
          .filter(Boolean) as ComboItem[],
      }));
    }

    // Cache the result (7-day TTL)
    DNA_CACHE.set(user_id, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error("API /api/outfits/dna crashed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 }
    );
  }
}
