import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';
import { callGeminiWithFallback } from '@/lib/gemini';

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
  never_tried: Array<{
    item_a: string;
    item_b: string;
    reason: string;
    item_a_id?: string | null;
    item_b_id?: string | null;
  }>;
  pattern_breakers: Array<{
    combo: string[];
    combo_items: ComboItem[];
    reason: string;
  }>;
  style_summary: string;
}

// In-memory cache with 7-day TTL
const DNA_CACHE = new Map<string, { data: OutfitDNA; ts: number }>();
const DNA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Color families for grouping
const COLOR_FAMILIES: Record<string, string[]> = {
  dark: [
    'black',
    'navy',
    'charcoal',
    'dark',
    'grey',
    'gray',
    'dark blue',
    'dark green',
    'burgundy',
    'maroon',
  ],
  light: [
    'white',
    'cream',
    'beige',
    'light',
    'pastel',
    'ivory',
    'off-white',
    'tan',
    'light blue',
    'light pink',
  ],
  earth: [
    'brown',
    'olive',
    'tan',
    'camel',
    'rust',
    'terracotta',
    'mustard',
    'khaki',
    'sage',
    'forest green',
  ],
  bright: [
    'red',
    'yellow',
    'orange',
    'pink',
    'lime',
    'cobalt',
    'electric',
    'coral',
    'fuchsia',
    'turquoise',
  ],
  blue: [
    'blue',
    'navy',
    'denim',
    'sky blue',
    'royal blue',
    'light blue',
    'teal',
  ],
  neutral: [
    'white',
    'black',
    'grey',
    'gray',
    'beige',
    'cream',
    'navy',
    'brown',
    'tan',
    'khaki',
  ],
};

function getColorFamily(color: string): string {
  const lower = color.toLowerCase();
  for (const [family, keywords] of Object.entries(COLOR_FAMILIES)) {
    if (keywords.some((kw) => lower.includes(kw))) return family;
  }
  return 'other';
}

const INCOMPATIBLE_USE_CASES: Record<string, string[]> = {
  casual: ['business', 'swim', 'sleep', 'date'],
  business: ['casual', 'sport', 'swim', 'sleep'],
  sport: ['business', 'swim', 'sleep', 'date'],
  sleep: ['casual', 'business', 'sport', 'swim', 'date'],
  swim: ['casual', 'business', 'sport', 'sleep', 'date'],
  date: ['casual', 'sport', 'swim', 'sleep'],
};

const INCOMPATIBLE_SEASONS: Record<string, string[]> = {
  Winter: ['Spring', 'Summer'],
  Spring: ['Winter'],
  Summer: ['Winter'],
};

function isCompatiblePair(
  a: { use_case?: string[]; season?: string },
  b: { use_case?: string[]; season?: string },
): boolean {
  // Check use_case compatibility
  const tagsA = a.use_case || [];
  const tagsB = b.use_case || [];
  if (tagsA.length > 0 && tagsB.length > 0) {
    for (const tagA of tagsA) {
      const blocked = INCOMPATIBLE_USE_CASES[tagA];
      if (blocked) {
        for (const tagB of tagsB) {
          if (blocked.includes(tagB)) return false;
        }
      }
    }
  }

  // Check season compatibility
  const seasonA = a.season || '';
  const seasonB = b.season || '';
  if (seasonA && seasonA !== 'All' && seasonB && seasonB !== 'All') {
    const blockedSeasons = INCOMPATIBLE_SEASONS[seasonA];
    if (blockedSeasons && blockedSeasons.includes(seasonB)) return false;
  }

  return true;
}

// Deterministic fallback: compute DNA from outfit history stats
function computeStatisticalDNA(
  outfitHistory: Array<{
    date: string;
    items: Array<{ name: string; type: string; color: string }>;
  }>,
  wardrobe: Array<{
    id: string;
    name: string;
    type: string;
    color: string;
    image_url: string | null;
    use_case?: string[];
    wear_count?: number;
    season?: string;
  }>,
): OutfitDNA {
  // 1. Strong pairs — co-occurrence count
  const pairCounts = new Map<
    string,
    { item_a: string; item_b: string; count: number }
  >();
  for (const outfit of outfitHistory) {
    const items = outfit.items;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const key = [items[i].name, items[j].name].sort().join('|||');
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
      const pattern = types.join(' + ');
      typePatternCounts.set(pattern, (typePatternCounts.get(pattern) || 0) + 1);
    }
  }
  const topPattern = [...typePatternCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const formula = topPattern ? topPattern[0].toLowerCase() : 'mixed styles';

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

  // 4. Never tried — items never paired, prioritizing underutilized items
  const wornPairs = new Set<string>();
  for (const outfit of outfitHistory) {
    for (let i = 0; i < outfit.items.length; i++) {
      for (let j = i + 1; j < outfit.items.length; j++) {
        wornPairs.add(
          [outfit.items[i].name, outfit.items[j].name].sort().join('|||'),
        );
      }
    }
  }
  const neverTriedCandidates: Array<{
    item_a: string;
    item_b: string;
    reason: string;
    item_a_id: string;
    item_b_id: string;
    score: number;
  }> = [];
  for (let i = 0; i < wardrobe.length; i++) {
    for (let j = i + 1; j < wardrobe.length; j++) {
      const key = [wardrobe[i].name, wardrobe[j].name].sort().join('|||');
      if (wornPairs.has(key) || wardrobe[i].type === wardrobe[j].type) continue;
      if (
        !isCompatiblePair(
          { use_case: wardrobe[i].use_case, season: wardrobe[i].season },
          { use_case: wardrobe[j].use_case, season: wardrobe[j].season },
        )
      )
        continue;
      if (
        wardrobe[i].use_case?.includes('sleep') ||
        wardrobe[j].use_case?.includes('sleep')
      )
        continue;

      let score = 0;
      const wearA = wardrobe[i].wear_count || 0;
      const wearB = wardrobe[j].wear_count || 0;
      const avgWear = (wearA + wearB) / 2;
      if (avgWear === 0) score += 25;
      else if (avgWear <= 2) score += 20;
      else if (avgWear <= 5) score += 15;
      else if (avgWear <= 10) score += 8;
      else score += 2;

      const fA = getColorFamily(wardrobe[i].color);
      const fB = getColorFamily(wardrobe[j].color);
      if (fA !== fB) score += 5;

      const complementary = [
        ['Tops', 'Bottoms'],
        ['Tops', 'One-Piece'],
        ['Outerwear', 'Tops'],
        ['Shoes', 'Bottoms'],
      ];
      const isComplementary = complementary.some(
        ([a, b]) =>
          (wardrobe[i].type === a && wardrobe[j].type === b) ||
          (wardrobe[i].type === b && wardrobe[j].type === a),
      );
      if (isComplementary) score += 3;

      const useA = wardrobe[i].use_case || [];
      const useB = wardrobe[j].use_case || [];
      const shared = useA.filter((u) => useB.includes(u));
      if (shared.length > 0) score += 4;

      neverTriedCandidates.push({
        item_a: wardrobe[i].name,
        item_b: wardrobe[j].name,
        reason: `${fA} pairs well with ${fB} tones`,
        item_a_id: wardrobe[i].id,
        item_b_id: wardrobe[j].id,
        score,
      });
    }
  }
  const never_tried = neverTriedCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ item_a, item_b, reason, item_a_id, item_b_id }) => ({
      item_a,
      item_b,
      reason,
      item_a_id,
      item_b_id,
    }));

  // 5. Pattern breakers — outfits that deviate from the dominant type pattern
  const pattern_breakers: Array<{
    combo: string[];
    combo_items: ComboItem[];
    reason: string;
  }> = [];
  if (topPattern) {
    const dominantTypes = topPattern[0].split(' + ');
    for (const outfit of outfitHistory) {
      const outfitTypes = [...new Set(outfit.items.map((i) => i.type))].sort();
      const isOutlier = outfitTypes.some((t) => !dominantTypes.includes(t));
      if (isOutlier && pattern_breakers.length < 3) {
        const comboItems: ComboItem[] = outfit.items.map((it) => {
          const match = wardrobe.find((w) => w.name === it.name);
          return {
            id: match?.id || '',
            name: it.name,
            type: it.type,
            color: it.color || null,
            image_url: match?.image_url || null,
          };
        });
        const hasSleep = comboItems.some((it) => {
          const match = wardrobe.find((w) => w.name === it.name);
          return match?.use_case?.includes('sleep');
        });
        if (hasSleep) continue;

        const allCompatible = comboItems.every((itemA, i) =>
          comboItems.slice(i + 1).every((itemB) => {
            const matchA = wardrobe.find((w) => w.name === itemA.name);
            const matchB = wardrobe.find((w) => w.name === itemB.name);
            return isCompatiblePair(
              { use_case: matchA?.use_case, season: matchA?.season },
              { use_case: matchB?.use_case, season: matchB?.season },
            );
          }),
        );
        if (!allCompatible) continue;
        const outfitTypeStr = outfitTypes.join(' + ');
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
  const uniqueItems = new Set(
    outfitHistory.flatMap((o) => o.items.map((i) => i.name)),
  ).size;
  const topPair = strong_pairs[0];
  let style_summary: string;
  if (topPair) {
    style_summary = `Across ${totalOutfits} outfits, your go-to pairing is ${topPair.item_a} with ${topPair.item_b} (${topPair.count}×). You work with ${uniqueItems} unique pieces. ${color_habits.length > 0 ? `Your palette leans ${color_habits[0].split(' ').slice(0, 3).join(' ')}.` : ''}`;
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
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 },
      );
    }

    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check cache first (7-day TTL)
    const cached = DNA_CACHE.get(user_id);
    if (cached && Date.now() - cached.ts < DNA_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = supabaseServer();

    // Fetch current valid item IDs
    const { data: currentItems } = await supabase
      .from('clothes')
      .select('id')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available');

    const validItemIds = new Set((currentItems || []).map((i) => i.id));

    // Fetch last 90 days of outfit plans
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
      .toISOString()
      .split('T')[0];
    const { data: plans } = await supabase
      .from('outfit_plans')
      .select('date, time_slot, slots')
      .eq('user_id', user_id)
      .gte('date', ninetyDaysAgo)
      .order('date', { ascending: false });

    if (!plans || plans.length < 3) {
      return NextResponse.json({
        formula: 'Not enough data yet',
        color_habits: [],
        strong_pairs: [],
        never_tried: [],
        pattern_breakers: [],
        style_summary: 'Wear more outfits to unlock your style DNA analysis.',
      });
    }

    // Build outfit history for Gemini (filter out deleted items)
    const outfitHistory = plans
      .map((plan) => {
        const items: Array<{ name: string; type: string; color: string }> = [];
        if (plan.slots && typeof plan.slots === 'object') {
          for (const val of Object.values(plan.slots)) {
            if (val && typeof val === 'object' && 'id' in val) {
              const item = val as {
                id: string;
                name: string;
                type: string;
                color?: string;
              };
              if (validItemIds.has(item.id)) {
                items.push({
                  name: item.name,
                  type: item.type,
                  color: item.color || 'unknown',
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
      .from('clothes')
      .select('id, name, type, color, season, image_url, use_case, wear_count')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available');

    const wardrobeSummary = (allClothes || []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color || 'unknown',
      season: c.season || 'All',
      image_url: c.image_url || null,
      use_case: c.use_case || [],
      wear_count: c.wear_count || 0,
    }));

    const prompt = `You are a minimalist wardrobe analyst. Analyze this user's outfit history (last 90 days) and identify their STYLE DNA — the underlying patterns in what they combine.

CRITICAL RULES for "never_tried" and "pattern_breakers":
- NEVER pair items with incompatible use_case tags
- Incompatible pairs: sleep↔any, casual↔business, casual↔swim, casual↔date, casual↔sleep, business↔sport, business↔swim, business↔sleep, sport↔swim, sport↔date, sport↔sleep, swim↔date, swim↔sleep, date↔casual, date↔sport, date↔swim, date↔sleep
- ALLOWED cross-use-case exceptions only: casual↔sport, business↔date
- Same-use-case pairings are always allowed (e.g., casual+casual, business+business, etc.)
- If both items have empty use_case, the pairing is allowed

SEASON RULES (each item has a season tag: Winter, Spring, Summer, Autumn, or All):
- NEVER pair Winter items with Spring or Summer items
- NEVER pair Spring/Summer items with Winter items
- Items tagged "All" season are compatible with everything
- Autumn items are transitional and can pair with any season
- If both items have empty season, the pairing is allowed

OUTFIT HISTORY:
${JSON.stringify(outfitHistory.slice(0, 50))}

FULL WARDROBE (each item has use_case and season tags — respect them when pairing):
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

    // Gemini with model fallback (flash-lite → flash → statistical)
    const response = await callGeminiWithFallback(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
    });
    let result: OutfitDNA | null = null;

    if (response?.ok) {
      const data = await response.json();
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      try {
        const jsonStr = text
          .replace(/```json?\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        result = JSON.parse(jsonStr);
      } catch {
        console.error('Gemini DNA parse failed:', text.slice(0, 200));
      }
    }

    // If Gemini failed, fall back to statistical analysis
    if (!result) {
      console.log('Gemini DNA failed — using statistical fallback');
      result = computeStatisticalDNA(outfitHistory, wardrobeSummary);
    }

    // Server-side use_case and season filtering (safety net)
    if (allClothes && result.never_tried?.length > 0) {
      result.never_tried = result.never_tried.filter((nt) => {
        const itemA = allClothes.find(
          (c) =>
            c.name === nt.item_a ||
            c.name.toLowerCase().includes(nt.item_a.toLowerCase()),
        );
        const itemB = allClothes.find(
          (c) =>
            c.name === nt.item_b ||
            c.name.toLowerCase().includes(nt.item_b.toLowerCase()),
        );
        if (!itemA || !itemB) return false;
        return isCompatiblePair(
          { use_case: itemA.use_case || [], season: itemA.season },
          { use_case: itemB.use_case || [], season: itemB.season },
        );
      });
    }

    if (allClothes && result.pattern_breakers?.length > 0) {
      result.pattern_breakers = result.pattern_breakers.filter((pb) => {
        const items = pb.combo
          .map((name) => {
            const exact = allClothes.find((c) => c.name === name);
            if (exact) return exact;
            return allClothes.find((c) =>
              c.name.toLowerCase().includes(name.toLowerCase()),
            );
          })
          .filter((item): item is NonNullable<typeof item> => item != null);
        if (items.length < 2) return false;
        return items.every((itemA, i) =>
          items
            .slice(i + 1)
            .every((itemB) =>
              isCompatiblePair(
                { use_case: itemA.use_case || [], season: itemA.season },
                { use_case: itemB.use_case || [], season: itemB.season },
              ),
            ),
        );
      });
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
          const overlap = searchWords.filter((w) =>
            keyWords.some((kw) => kw.includes(w) || w.includes(kw)),
          ).length;
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

    // Add item IDs to never_tried for client-side dedup
    if (allClothes && result.never_tried?.length > 0) {
      result.never_tried = result.never_tried.map((nt) => {
        const itemA = allClothes.find(
          (c) =>
            c.name === nt.item_a ||
            c.name.toLowerCase().includes(nt.item_a.toLowerCase()),
        );
        const itemB = allClothes.find(
          (c) =>
            c.name === nt.item_b ||
            c.name.toLowerCase().includes(nt.item_b.toLowerCase()),
        );
        return {
          ...nt,
          item_a_id: itemA?.id || null,
          item_b_id: itemB?.id || null,
        };
      });
    }

    // Cache the result (7-day TTL)
    DNA_CACHE.set(user_id, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API /api/outfits/dna crashed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Error' },
      { status: 500 },
    );
  }
}
