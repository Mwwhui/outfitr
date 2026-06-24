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

// Color families for grouping
const COLOR_FAMILIES: Record<string, string[]> = {
  dark: ["black", "navy", "charcoal", "dark", "grey", "gray", "dark blue", "dark green", "burgundy", "maroon"],
  light: ["white", "cream", "beige", "light", "pastel", "ivory", "off-white", "tan", "light blue", "light pink"],
  earth: ["brown", "olive", "tan", "camel", "rust", "terracotta", "mustard", "khaki", "sage", "forest green"],
  bright: ["red", "yellow", "orange", "pink", "lime", "cobalt", "electric", "coral", "fuchsia", "turquoise"],
  blue: ["blue", "navy", "denim", "sky blue", "royal blue", "light blue", "teal"],
  neutral: ["white", "black", "grey", "gray", "beige", "cream", "navy", "brown", "tan", "khaki"],
};

function getColorFamily(color: string): string {
  const lower = color.toLowerCase();
  for (const [family, keywords] of Object.entries(COLOR_FAMILIES)) {
    if (keywords.some((kw) => lower.includes(kw))) return family;
  }
  return "other";
}

// Deterministic fallback: compute DNA from outfit history stats
function computeStatisticalDNA(
  outfitHistory: Array<{ date: string; items: Array<{ name: string; type: string; color: string }> }>,
  wardrobe: Array<{ id: string; name: string; type: string; color: string; image_url: string | null }>
): OutfitDNA {
  // 1. Strong pairs — co-occurrence count
  const pairCounts = new Map<string, { item_a: string; item_b: string; count: number }>();
  for (const outfit of outfitHistory) {
    const items = outfit.items;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const key = [items[i].name, items[j].name].sort().join("|||");
        const existing = pairCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          pairCounts.set(key, {
            item_a: items[i].name,
            item_b: items[j].name,
            count: 1,
          });
        }
      }
    }
  }
  const strong_pairs = [...pairCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 2. Formula — most common type combo pattern
  const typePatternCounts = new Map<string, number>();
  for (const outfit of outfitHistory) {
    const types = [...new Set(outfit.items.map((i) => i.type))].sort();
    if (types.length >= 2) {
      const pattern = types.join(" + ");
      typePatternCounts.set(pattern, (typePatternCounts.get(pattern) || 0) + 1);
    }
  }
  const topPattern = [...typePatternCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const formula = topPattern ? topPattern[0].toLowerCase() : "mixed styles";

  // 3. Color habits — dominant color family per type
  const typeColors = new Map<string, Map<string, number>>();
  for (const outfit of outfitHistory) {
    for (const item of outfit.items) {
      const family = getColorFamily(item.color);
      if (!typeColors.has(item.type)) typeColors.set(item.type, new Map());
      const colorMap = typeColors.get(item.type)!;
      colorMap.set(family, (colorMap.get(family) || 0) + 1);
    }
  }
  const color_habits: string[] = [];
  for (const [type, colorMap] of typeColors) {
    const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length >= 2 && sorted[0][1] > 1) {
      const dominant = sorted[0][0];
      const secondary = sorted[1][0];
      if (dominant !== secondary) {
        color_habits.push(`${dominant} ${type}s with ${secondary} pairings`);
      } else {
        color_habits.push(`mostly ${dominant} ${type}s`);
      }
    }
  }

  // 4. Never tried — items never paired that share complementary colors
  const wornPairs = new Set<string>();
  for (const outfit of outfitHistory) {
    for (let i = 0; i < outfit.items.length; i++) {
      for (let j = i + 1; j < outfit.items.length; j++) {
        wornPairs.add([outfit.items[i].name, outfit.items[j].name].sort().join("|||"));
      }
    }
  }
  const never_tried: Array<{ item_a: string; item_b: string; reason: string }> = [];
  for (let i = 0; i < wardrobe.length; i++) {
    for (let j = i + 1; j < wardrobe.length; j++) {
      const key = [wardrobe[i].name, wardrobe[j].name].sort().join("|||");
      if (!wornPairs.has(key) && wardrobe[i].type !== wardrobe[j].type) {
        const fA = getColorFamily(wardrobe[i].color);
        const fB = getColorFamily(wardrobe[j].color);
        if (fA !== fB && never_tried.length < 5) {
          never_tried.push({
            item_a: wardrobe[i].name,
            item_b: wardrobe[j].name,
            reason: `${fA} pairs well with ${fB} tones`,
          });
        }
      }
    }
  }

  // 5. Pattern breakers — outfits that deviate from the dominant type pattern
  const pattern_breakers: Array<{ combo: string[]; combo_items: ComboItem[]; reason: string }> = [];
  if (topPattern) {
    const dominantTypes = topPattern[0].split(" + ");
    for (const outfit of outfitHistory) {
      const outfitTypes = [...new Set(outfit.items.map((i) => i.type))].sort();
      const isOutlier = outfitTypes.some((t) => !dominantTypes.includes(t));
      if (isOutlier && pattern_breakers.length < 3) {
        const comboItems: ComboItem[] = outfit.items.map((it) => {
          const match = wardrobe.find((w) => w.name === it.name);
          return {
            id: match?.id || "",
            name: it.name,
            type: it.type,
            color: it.color || null,
            image_url: match?.image_url || null,
          };
        });
        const outfitTypeStr = outfitTypes.join(" + ");
        pattern_breakers.push({
          combo: outfit.items.map((i) => i.name),
          combo_items: comboItems,
          reason: `usually you wear ${formula} but this uses ${outfitTypeStr}`,
        });
      }
    }
  }

  // 6. Style summary — template-based
  const totalOutfits = outfitHistory.length;
  const uniqueItems = new Set(outfitHistory.flatMap((o) => o.items.map((i) => i.name))).size;
  const topPair = strong_pairs[0];
  let style_summary: string;
  if (topPair) {
    style_summary = `Across ${totalOutfits} outfits, your go-to pairing is ${topPair.item_a} with ${topPair.item_b} (${topPair.count}×). You work with ${uniqueItems} unique pieces. ${color_habits.length > 0 ? `Your palette leans ${color_habits[0].split(" ").slice(0, 3).join(" ")}.` : ""}`;
  } else {
    style_summary = `You've put together ${totalOutfits} outfits with ${uniqueItems} unique pieces. Keep exploring to reveal more patterns.`;
  }

  return {
    formula,
    color_habits: color_habits.slice(0, 3),
    strong_pairs,
    never_tried,
    pattern_breakers,
    style_summary,
  };
}

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

    // Retry Gemini with exponential backoff, fall back to statistical analysis
    const MAX_RETRIES = 3;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    let result: OutfitDNA | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          try {
            const jsonStr = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
            result = JSON.parse(jsonStr);
            break; // Success — exit retry loop
          } catch {
            // Parse failed — treat as failed attempt
            console.error("Gemini DNA parse failed:", text.slice(0, 200));
          }
        } else {
          const errText = await response.text();
          console.error(`Gemini DNA error (attempt ${attempt + 1}/${MAX_RETRIES}):`, errText);
          // Don't retry on 4xx client errors (except 429)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
        }
      } catch (e) {
        console.error(`Gemini DNA fetch error (attempt ${attempt + 1}/${MAX_RETRIES}):`, e);
      }
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }

    // If Gemini failed, fall back to statistical analysis
    if (!result) {
      console.log("Gemini DNA failed — using statistical fallback");
      result = computeStatisticalDNA(outfitHistory, wardrobeSummary);
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
