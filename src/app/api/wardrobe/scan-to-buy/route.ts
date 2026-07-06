import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';
import { normalizeColor, colorSimilarity } from '@/lib/colorNorm';
import { pairHarmony } from '@/lib/colorUtils';
import { callGeminiWithFallback } from '@/lib/gemini';

export const maxDuration = 60;

// ---------- Types ----------

interface WearItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
  wear_count: number;
  season: string | null;
  price: number | null;
  material: string | null;
  use_case: string[] | null;
}

interface DetectedGarment {
  type: string;
  color: string;
  material: string;
  formality: string;
  season: string;
  pattern: string;
  style_keywords: string[];
}

interface SimilarItem {
  name: string;
  image_url: string | null;
  id: string;
}

interface SuggestedPairing {
  name: string;
  type: string;
  image_url: string | null;
  color: string | null;
}

interface GhostItem {
  name: string;
  image_url: string | null;
  id: string;
  wear_count: number;
}

interface BudgetContext {
  item_price: number;
  wardrobe_average: number;
  wardrobe_median: number;
  wardrobe_max: number;
  flag: 'over_budget' | 'within_budget';
}

interface ScanResult {
  score: number;
  verdict: 'worth_it' | 'consider' | 'skip';
  one_liner: string;
  reasoning: string;
  breakdown: {
    gap_fill: number;
    color_fit: number;
    similarity_risk: number;
    outfit_potential: number;
    versatility: number;
  };
  outfit_multiplier: number;
  cost_per_wear: {
    estimated_price: number;
    projected_wears: number;
    projected_cpw: number;
    wardrobe_average_cpw: number;
    verdict: 'below_average' | 'similar' | 'above_average';
  } | null;
  similar_items: SimilarItem[];
  suggested_pairings: SuggestedPairing[];
  ghost_items: GhostItem[];
  budget_context: BudgetContext | null;
}

// ---------- Cache ----------

const SCAN_CACHE = new Map<string, { data: ScanResult; ts: number }>();
const SCAN_CACHE_TTL = 24 * 60 * 60 * 1000;

// ---------- Helpers ----------

const IDEAL_RATIOS: Record<string, number> = {
  Tops: 3,
  Bottoms: 2,
  Outerwear: 1,
  'One-Piece': 0.5,
};

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}

// ---------- YOLO type mapping ----------

const YOLO_CATEGORY_MAP: [RegExp, string][] = [
  [/shirt|blouse|t[- ]?shirts?|tank\s*top|crop\s*top|top|sweater|hoodie|cardigan|polo|henley|turtleneck|pullover|jumper|sweatshirt|vest/, 'Tops'],
  [/pants|jeans|trousers|leggings|shorts|skirt|chinos|slacks|joggers|sweatpants|culottes/, 'Bottoms'],
  [/jacket|coat|blazer|parka|puffer|trench|bomber|denim\s*jacket|leather\s*jacket|windbreaker|raincoat|overcoat/, 'Outerwear'],
  [/dress|jumpsuit|romper|overalls|bodysuit|gown/, 'One-Piece'],
  [/shoe|sneaker|boot|sandal|heel|loafer|flats?|mules?|oxford|pump/, 'Shoes'],
  [/hat|cap|bag|belt|scarf|watch|glasses|sunglasses|jewelry|necklace|earring|bracelet|wallet|backpack/, 'Accessories'],
];

function mapYoloTypeToCategory(yoloType: string): string {
  const t = yoloType.toLowerCase().trim();
  for (const [pattern, category] of YOLO_CATEGORY_MAP) {
    if (pattern.test(t)) return category;
  }
  return 'Tops';
}

// ---------- Step 1b: YOLO-first garment detection ----------

async function enrichGarmentWithGemini(
  apiKey: string,
  category: string,
  color: string,
  yoloType: string,
): Promise<Pick<DetectedGarment, 'material' | 'formality' | 'season' | 'pattern' | 'style_keywords'>> {
  const prompt = `Given this garment:
- Type: ${category} (detected as: ${yoloType})
- Color: ${color}

Return ONLY valid JSON (no markdown):
{
  "material": "best guess fabric (cotton, wool, denim, silk, linen, synthetic, leather, knit)",
  "formality": "casual" | "smart" | "formal",
  "season": "Spring" | "Summer" | "Autumn" | "Winter" | "All",
  "pattern": "solid" | "striped" | "plaid" | "floral" | "polka" | "geometric" | "other",
  "style_keywords": ["up to 3 relevant tags from: minimalist, classic, streetwear, bohemian, sporty, edgy, romantic, preppy, vintage"]
}`;

  const response = await callGeminiWithFallback(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
  }, 0);

  if (!response || !response.ok) {
    return { material: '', formality: 'casual', season: 'All', pattern: 'solid', style_keywords: [] };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  try {
    const jsonStr = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    return {
      material: typeof parsed.material === 'string' ? parsed.material : '',
      formality: ['casual', 'smart', 'formal'].includes(parsed.formality) ? parsed.formality : 'casual',
      season: ['Spring', 'Summer', 'Autumn', 'Winter', 'All'].includes(parsed.season) ? parsed.season : 'All',
      pattern: typeof parsed.pattern === 'string' ? parsed.pattern : 'solid',
      style_keywords: Array.isArray(parsed.style_keywords) ? parsed.style_keywords : [],
    };
  } catch {
    return { material: '', formality: 'casual', season: 'All', pattern: 'solid', style_keywords: [] };
  }
}

async function detectGarmentWithYolo(
  apiKey: string,
  base64Data: string,
  mimeType: string,
): Promise<{ garment: DetectedGarment; source: 'yolo' | 'gemini' }> {
  let yoloResult: { type: string; color: string; confidence: number } | null = null;

  try {
    const yoloUrl = process.env.NEXT_PUBLIC_YOLO_API_URL;
    if (yoloUrl) {
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, `image.${mimeType.split('/')[1] || 'jpeg'}`);

      const yoloRes = await fetch(`${yoloUrl}/auto-detect`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(10000),
      });

      if (yoloRes.ok) {
        const data = await yoloRes.json();
        if (data.confidence >= 0.6 && data.type) {
          yoloResult = { type: data.type, color: data.color || '', confidence: data.confidence };
        }
      }
    }
  } catch (err) {
    console.error('[scan-to-buy] YOLO detection failed:', err);
  }

  if (yoloResult) {
    const category = mapYoloTypeToCategory(yoloResult.type);
    const enrichment = await enrichGarmentWithGemini(apiKey, category, yoloResult.color, yoloResult.type);
    return {
      garment: { type: category, color: yoloResult.color, ...enrichment },
      source: 'yolo',
    };
  }

  const garment = await detectGarment(apiKey, base64Data, mimeType);
  return { garment, source: 'gemini' };
}

// ---------- Step 1c: Gemini garment detection ----------

async function detectGarment(
  apiKey: string,
  base64Data: string,
  mimeType: string,
): Promise<DetectedGarment> {
  const prompt = `Analyze the clothing item in this image. Ignore background, hangers, mannequins, or human skin. Identify the garment's attributes as precisely as possible.

Return ONLY valid JSON (no markdown, no extra text):
{
  "type": "Tops" | "Bottoms" | "Outerwear" | "One-Piece" | "Shoes" | "Accessories",
  "color": "primary color name (e.g. 'Navy Blue', 'Olive Green', 'Cream', 'Burgundy')",
  "material": "fabric material guess (e.g. 'cotton', 'wool', 'denim', 'silk', 'linen', 'synthetic', 'leather')",
  "formality": "casual" | "smart" | "formal",
  "season": "Spring" | "Summer" | "Autumn" | "Winter" | "All",
  "pattern": "solid" | "striped" | "plaid" | "floral" | "polka" | "geometric" | "other",
  "style_keywords": ["minimalist", "classic", "streetwear", "bohemian", "sporty", "edgy", "romantic", "preppy", "vintage"]
}

Be specific with color names. If lighting is poor, compensate (e.g., white garment in warm light is still 'White').`;

  const response = await callGeminiWithFallback(apiKey, {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } },
        ],
      },
    ],
  }, 0);

  if (!response || !response.ok) {
    return {
      type: 'Tops',
      color: '',
      material: '',
      formality: 'casual',
      season: 'All',
      pattern: 'solid',
      style_keywords: [],
    };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  try {
    const jsonStr = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return {
      type: 'Tops',
      color: '',
      material: '',
      formality: 'casual',
      season: 'All',
      pattern: 'solid',
      style_keywords: [],
    };
  }
}

// ---------- Step 1d: Duplicate/similarity check ----------

function computeSimilarityRisk(
  garment: DetectedGarment,
  clothes: WearItem[],
): { risk: number; similarItems: SimilarItem[] } {
  const sameType = clothes.filter(
    (c) => c.type.toLowerCase() === garment.type.toLowerCase(),
  );

  if (sameType.length === 0) return { risk: 0, similarItems: [] };

  const scores = sameType.map((c) => ({
    id: c.id,
    name: c.name,
    image_url: c.image_url,
    similarity: colorSimilarity(garment.color, c.color || ''),
  }));

  const high = scores.filter((s) => s.similarity >= 0.6);
  if (high.length === 0) return { risk: 0, similarItems: [] };

  const avgSim = high.reduce((s, h) => s + h.similarity, 0) / high.length;
  const risk = Math.min(100, Math.round(avgSim * 100 + high.length * 5));

  return {
    risk,
    similarItems: high.slice(0, 3).map((h) => ({
      name: h.name,
      image_url: h.image_url,
      id: h.id,
    })),
  };
}

// ---------- Step 1e: Gap fill analysis ----------

function computeGapFill(
  garment: DetectedGarment,
  clothes: WearItem[],
): number {
  let score = 0;

  // Seasonal gap
  const currentSeason = getCurrentSeason();
  const seasonTypes = new Set(
    clothes
      .filter((c) => {
        if (!c.season) return true;
        const s = c.season.toLowerCase();
        return (
          s.includes(currentSeason.toLowerCase()) || s.includes('all')
        );
      })
      .map((c) => c.type),
  );
  if (!seasonTypes.has(garment.type)) {
    score += 40;
  }

  // Category balance
  const categoryCount = new Map<string, number>();
  for (const c of clothes) {
    categoryCount.set(c.type, (categoryCount.get(c.type) || 0) + 1);
  }
  const totalUnits =
    Array.from(categoryCount.values()).reduce((a, b) => a + b, 0) || 1;
  const current = categoryCount.get(garment.type) || 0;
  const ideal = Math.max(
    1,
    Math.round(((IDEAL_RATIOS[garment.type] || 1) / 6.5) * totalUnits),
  );
  if (current < ideal * 0.5) {
    score += 30;
  } else if (current < ideal * 0.8) {
    score += 15;
  }

  // Color diversity
  const colorCount = new Map<string, number>();
  for (const c of clothes) {
    if (c.color) {
      const norm = normalizeColor(c.color);
      colorCount.set(norm, (colorCount.get(norm) || 0) + 1);
    }
  }
  const garmentNorm = normalizeColor(garment.color);
  const garmentColorPct = garmentNorm
    ? (colorCount.get(garmentNorm) || 0) / clothes.length
    : 0;
  if (garmentColorPct < 0.1) {
    score += 30;
  } else if (garmentColorPct < 0.25) {
    score += 15;
  }

  return Math.min(100, score);
}

// ---------- Step 1f: Outfit multiplier ----------

function computeOutfitMultiplier(
  garment: DetectedGarment,
  clothes: WearItem[],
): { multiplier: number; pairings: SuggestedPairing[] } {
  const slotCompat: Record<string, string[]> = {
    Tops: ['Bottoms', 'Outerwear'],
    Bottoms: ['Tops', 'Outerwear'],
    Outerwear: ['Tops', 'Bottoms'],
    'One-Piece': ['Outerwear'],
    Shoes: ['Tops', 'Bottoms', 'Outerwear', 'One-Piece'],
    Accessories: ['Tops', 'Bottoms', 'Outerwear', 'One-Piece'],
  };

  const compatibleSlots = slotCompat[garment.type] || [];

  let count = 0;
  const pairings: SuggestedPairing[] = [];

  for (const slotType of compatibleSlots) {
    const candidates = clothes.filter(
      (c) => c.type === slotType && c.color,
    );
    for (const c of candidates) {
      const harmony = pairHarmony(garment.color, c.color || '');
      if (harmony.score >= 0.7) {
        count++;
        if (pairings.length < 5) {
          pairings.push({
            name: c.name,
            type: c.type,
            image_url: c.image_url,
            color: c.color,
          });
        }
      }
    }
  }

  return { multiplier: count, pairings };
}

// ---------- Step 1g: CPW forecast ----------

function computeCostPerWear(
  garment: DetectedGarment,
  clothes: WearItem[],
  price?: number,
): ScanResult['cost_per_wear'] {
  if (!price || price <= 0) return null;

  const itemsWithPrice = clothes.filter((c) => c.price != null);
  const priceSum = itemsWithPrice.reduce((s, c) => s + Number(c.price), 0);
  const avgPrice =
    itemsWithPrice.length > 0 ? priceSum / itemsWithPrice.length : 30;
  const totalValue =
    itemsWithPrice.length > 0
      ? priceSum + (clothes.length - itemsWithPrice.length) * avgPrice
      : clothes.length * 30;
  const totalWears = clothes.reduce((s, c) => s + (c.wear_count || 0), 0);
  const wardrobeAvgCpw =
    totalValue > 0 && totalWears > 0 ? totalValue / totalWears : 0;

  // Estimate projected wears
  const seasonBoost =
    garment.season === 'All'
      ? 4
      : garment.season.toLowerCase() === getCurrentSeason().toLowerCase()
        ? 2
        : 1;
  const versatilityBoost = garment.style_keywords.length > 2 ? 1.5 : 1;
  const projectedWears = Math.round(10 * seasonBoost * versatilityBoost);

  const projectedCpw = projectedWears > 0 ? price / projectedWears : price;

  let cpwVerdict: 'below_average' | 'similar' | 'above_average' = 'similar';
  if (wardrobeAvgCpw > 0) {
    if (projectedCpw < wardrobeAvgCpw * 0.8) cpwVerdict = 'below_average';
    else if (projectedCpw > wardrobeAvgCpw * 1.2) cpwVerdict = 'above_average';
  }

  return {
    estimated_price: price,
    projected_wears: projectedWears,
    projected_cpw: Math.round(projectedCpw * 100) / 100,
    wardrobe_average_cpw: Math.round(wardrobeAvgCpw * 100) / 100,
    verdict: cpwVerdict,
  };
}

// ---------- Step 1h: Ghost item check ----------

function computeGhostItems(
  garment: DetectedGarment,
  clothes: WearItem[],
): GhostItem[] {
  const sameType = clothes.filter(
    (c) => c.type.toLowerCase() === garment.type.toLowerCase(),
  );

  const ghosts: GhostItem[] = [];
  for (const c of sameType) {
    if (c.wear_count >= 3) continue;
    if (!c.color || !garment.color) continue;
    const sim = colorSimilarity(garment.color, c.color);
    if (sim >= 0.6) {
      ghosts.push({
        name: c.name,
        image_url: c.image_url,
        id: c.id,
        wear_count: c.wear_count,
      });
    }
  }

  return ghosts.slice(0, 3);
}

// ---------- Step 1i: Budget context ----------

function computeBudgetContext(
  garment: DetectedGarment,
  clothes: WearItem[],
  price?: number,
): BudgetContext | null {
  if (!price || price <= 0) return null;

  const prices = clothes
    .map((c) => Number(c.price))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) return null;

  const sum = prices.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / prices.length);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0
    ? Math.round((prices[mid - 1] + prices[mid]) / 2)
    : prices[mid];
  const max = prices[prices.length - 1];

  const flag: BudgetContext['flag'] = price > avg * 2 ? 'over_budget' : 'within_budget';

  return {
    item_price: price,
    wardrobe_average: avg,
    wardrobe_median: median,
    wardrobe_max: max,
    flag,
  };
}

// ---------- Step 1j: Gemini verdict ----------

async function generateVerdict(
  apiKey: string,
  garment: DetectedGarment,
  clothes: WearItem[],
  similarityRisk: number,
  similarItems: SimilarItem[],
  gapFill: number,
  outfitMultiplier: number,
  pairings: SuggestedPairing[],
  cpw: ScanResult['cost_per_wear'],
): Promise<{ score: number; verdict: ScanResult['verdict']; one_liner: string; reasoning: string; breakdown: ScanResult['breakdown'] }> {
  // Compute color fit
  const colorFit =
    garment.color && clothes.length > 0
      ? Math.round(
          (clothes
            .filter((c) => c.color)
            .reduce(
              (sum, c) =>
                sum + pairHarmony(garment.color, c.color || '').score,
              0,
            ) /
            Math.max(1, clothes.filter((c) => c.color).length)) *
            100,
        )
      : 50;

  // Compute versatility
  const currentSeason = getCurrentSeason();
  const versatility =
    garment.season === 'All'
      ? 100
      : garment.season.toLowerCase() === currentSeason.toLowerCase()
        ? 80
        : 50;

  // Algorithmic score first
  const algoScore = Math.max(
    0,
    Math.min(
      100,
      gapFill * 0.25 +
        colorFit * 0.15 +
        outfitMultiplier * 0.25 +
        versatility * 0.15 +
        (100 - similarityRisk) * 0.1 +
        (cpw?.verdict === 'below_average' ? 10 : cpw?.verdict === 'above_average' ? -10 : 0) * 0.1,
    ),
  );

  // Try Gemini for enrichment
  const clothesSummary = clothes
    .slice(0, 20)
    .map((c) => `${c.name} (${c.type}, ${c.color || 'no color'})`)
    .join(', ');

  const prompt = `You are a minimalist wardrobe advisor. Evaluate whether this garment is worth buying for the user.

GARMENT DETECTED:
- Type: ${garment.type}
- Color: ${garment.color}
- Material: ${garment.material || 'unknown'}
- Formality: ${garment.formality}
- Season: ${garment.season}
- Style: ${garment.style_keywords.join(', ') || 'versatile'}

USER'S WARDROBE (${clothes.length} items):
${clothesSummary}

ANALYSIS RESULTS:
- Gap fill score: ${gapFill}/100 (how much this fills a wardrobe gap)
- Color fit: ${colorFit}/100 (how well it matches existing palette)
- Similarity risk: ${similarityRisk}/100 (${similarItems.length > 0 ? similarItems.map(s => s.name).join(', ') : 'none similar'})
- Outfit multiplier: ${outfitMultiplier} new combos possible
- Versatility: ${versatility}/100
${cpw ? `- Cost per wear: $${cpw.projected_cpw} vs wardrobe avg $${cpw.wardrobe_average_cpw}` : '- Price: not provided'}

Return ONLY valid JSON (no markdown, no extra text):
{
  "score": 0-100,
  "verdict": "worth_it" | "consider" | "skip",
  "one_liner": "One short sentence explaining the verdict",
  "reasoning": "2-3 sentences with specific wardrobe context",
  "breakdown": {
    "gap_fill": ${gapFill},
    "color_fit": ${colorFit},
    "similarity_risk": ${similarityRisk},
    "outfit_potential": ${outfitMultiplier > 5 ? Math.min(100, outfitMultiplier * 10) : outfitMultiplier * 15},
    "versatility": ${versatility}
  }
}`;

  const response = await callGeminiWithFallback(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
  }, 0);

  if (!response || !response.ok) {
    const verdict: ScanResult['verdict'] =
      algoScore >= 70 ? 'worth_it' : algoScore >= 40 ? 'consider' : 'skip';
    return {
      score: algoScore,
      verdict,
      one_liner: `Based on your wardrobe data, this gets a ${algoScore}/100.`,
      reasoning: `This ${garment.color.toLowerCase()} ${garment.type.toLowerCase()} ${gapFill > 50 ? 'fills a gap in your wardrobe' : 'is similar to items you own'}. ${outfitMultiplier > 5 ? `It can create ${outfitMultiplier} new outfit combinations.` : ''}${similarityRisk > 60 ? ' However, you have very similar items already.' : ''}`,
      breakdown: {
        gap_fill: gapFill,
        color_fit: colorFit,
        similarity_risk: similarityRisk,
        outfit_potential:
          outfitMultiplier > 5
            ? Math.min(100, outfitMultiplier * 10)
            : outfitMultiplier * 15,
        versatility,
      },
    };
  }

  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  try {
    const jsonStr = text
      .replace(/```json?\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    return JSON.parse(jsonStr);
  } catch {
    return {
      score: algoScore,
      verdict: algoScore >= 70 ? 'worth_it' : algoScore >= 40 ? 'consider' : 'skip',
      one_liner: `This gets a ${algoScore}/100.`,
      reasoning: text || 'Analysis complete.',
      breakdown: {
        gap_fill: gapFill,
        color_fit: colorFit,
        similarity_risk: similarityRisk,
        outfit_potential:
          outfitMultiplier > 5
            ? Math.min(100, outfitMultiplier * 10)
            : outfitMultiplier * 15,
        versatility,
      },
    };
  }
}

// ---------- POST handler ----------

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { image_base64, mimeType, price } = body;

    if (!image_base64 || !mimeType) {
      return NextResponse.json(
        { error: 'image_base64 and mimeType are required' },
        { status: 400 },
      );
    }

    // Check cache
    const cacheKey = image_base64.slice(0, 32);
    const cached = SCAN_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < SCAN_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 },
      );
    }

    // Fetch user's wardrobe
    const supabase = supabaseServer();
    const { data: clothesData } = await supabase
      .from('clothes')
      .select(
        'id, name, type, color, image_url, wear_count, season, price, material, use_case',
      )
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available');

    const clothes: WearItem[] = (clothesData || []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color,
      image_url: c.image_url,
      wear_count: c.wear_count || 0,
      season: c.season,
      price: c.price,
      material: c.material,
      use_case: c.use_case,
    }));

    // Step 1b/c: Detect garment (YOLO-first, Gemini vision fallback)
    const { garment } = await detectGarmentWithYolo(apiKey, image_base64, mimeType);

    // Step 1d: Duplicate check
    const { risk: similarityRisk, similarItems } =
      computeSimilarityRisk(garment, clothes);

    // Step 1e: Gap fill
    const gapFill = computeGapFill(garment, clothes);

    // Step 1f: Outfit multiplier
    const { multiplier: outfitMultiplier, pairings } =
      computeOutfitMultiplier(garment, clothes);

    // Step 1g: CPW forecast
    const cpw = computeCostPerWear(garment, clothes, price);

    // Step 1h: Ghost item check
    const ghostItems = computeGhostItems(garment, clothes);

    // Step 1i: Budget context
    const budgetContext = computeBudgetContext(garment, clothes, price);

    // Step 1j: Gemini verdict
    const verdict = await generateVerdict(
      apiKey,
      garment,
      clothes,
      similarityRisk,
      similarItems,
      gapFill,
      outfitMultiplier,
      pairings,
      cpw,
    );

    const result: ScanResult = {
      score: verdict.score,
      verdict: verdict.verdict,
      one_liner: verdict.one_liner,
      reasoning: verdict.reasoning,
      breakdown: verdict.breakdown,
      outfit_multiplier: outfitMultiplier,
      cost_per_wear: cpw,
      similar_items: similarItems,
      suggested_pairings: pairings,
      ghost_items: ghostItems,
      budget_context: budgetContext,
    };

    // Cache the result
    SCAN_CACHE.set(cacheKey, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('/api/wardrobe/scan-to-buy crashed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal Error',
      },
      { status: 500 },
    );
  }
}
