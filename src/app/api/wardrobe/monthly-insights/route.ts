import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';
import { callGeminiWithFallback } from '@/lib/gemini';

const INSIGHTS_CACHE = new Map<string, { data: unknown; ts: number }>();
const INSIGHTS_CACHE_TTL = process.env.NODE_ENV === 'development' ? 0 : 24 * 60 * 60 * 1000;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY || '';

async function fetchCurrentWeather(): Promise<{ temp: number; description: string } | null> {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current=temperature_2m,weathercode',
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const code = data.current?.weathercode ?? 0;
    const descriptions: Record<number, string> = {
      0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
      45: 'foggy', 48: 'rime fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
      61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow',
      75: 'heavy snow', 80: 'light showers', 81: 'showers', 82: 'heavy showers',
      95: 'thunderstorm', 96: 'hail storm',
    };
    return {
      temp: Math.round(data.current?.temperature_2m ?? 15),
      description: descriptions[code] ?? 'clear',
    };
  } catch {
    return null;
  }
}

async function searchPixabayImage(query: string): Promise<string | null> {
  if (!PIXABAY_KEY) return null;
  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3&category=fashion&min_width=300`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.hits?.[0]?.webformatURL || null;
  } catch {
    return null;
  }
}

const IDEAL_RATIOS: Record<string, number> = {
  Tops: 3,
  Bottoms: 2,
  Outerwear: 1,
  'One-Piece': 0.5,
};

const COLOR_MAP: Record<string, string> = {
  black: '#1a1a1a', white: '#f5f5f5', cream: '#fffdd0', ivory: '#fffff0',
  beige: '#f5f5dc', tan: '#d2b48c', khaki: '#c3b091', camel: '#c19a6b',
  brown: '#8b4513', chocolate: '#7b3f00',
  navy: '#000080', blue: '#3b82f6', 'light blue': '#93c5fd', 'sky blue': '#7dd3fc',
  'royal blue': '#4169e1', denim: '#1560bd', teal: '#008080',
  red: '#dc2626', burgundy: '#800020', maroon: '#800000', crimson: '#dc143c',
  pink: '#ec4899', coral: '#f97316', salmon: '#fa8072', fuchsia: '#ff00ff',
  orange: '#f97316', rust: '#b7410e', terracotta: '#e2725b',
  yellow: '#facc15', mustard: '#ffdb58', gold: '#ffd700', olive: '#808000',
  green: '#22c55e', 'forest green': '#228b22', sage: '#9dc183', 'dark green': '#006400',
  grey: '#9ca3af', gray: '#9ca3af', charcoal: '#36454f', silver: '#c0c0c0',
  purple: '#a855f7', violet: '#8b5cf6', lavender: '#e6e6fa', plum: '#8e4585',
};

function getColorHex(color: string | null): string | null {
  if (!color) return null;
  const lower = color.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return hex;
  }
  return null;
}

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}

function getNextSeason(): string {
  const current = getCurrentSeason();
  const order = ['Spring', 'Summer', 'Fall', 'Winter'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % 4];
}

interface WearItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  image_url: string | null;
  wear_count: number;
  season: string | null;
  price: number | null;
  unused_score: number | null;
  material: string | null;
  use_case: string[] | null;
}

interface ColorPaletteItem {
  color: string;
  hex: string | null;
  count: number;
  pct: number;
}

interface CategoryBalanceItem {
  type: string;
  count: number;
  ideal: number;
  pct: number;
}

interface MonthlyInsights {
  greeting: string;
  headline: string;
  month_theme: string;
  summary: string;
  fun_fact: string;
  wear_streak: number;
  wear_streak_text: string;
  items_in_wardrobe_text: string;
  cost_per_wear_trend_text: string;
  empty_outfit_text: string;
  empty_outfit_cta: string;
  insufficient_items_text: string;
  insufficient_items_cta: string;
  error_title: string;
  error_button: string;
  wear_more: Array<{
    item_id: string;
    name: string;
    image_url: string | null;
    type: string;
    reason: string;
    suggested_combo: string;
    times_worn_this_month: number;
    total_wears: number;
  }>;
  most_worn: Array<{
    item_id: string;
    name: string;
    image_url: string | null;
    type: string;
    times_worn_this_month: number;
    total_wears: number;
  }>;
  shopping_list: Array<{
    item_type: string;
    specific_name: string;
    color: string;
    material: string;
    use_case: string;
    image_url: string | null;
    search_query: string;
    priority: 'high' | 'medium' | 'low';
    reason_category: 'seasonal_gap' | 'category_balance' | 'color_diversity';
  }>;
  seasonal_tip: {
    season: string;
    next_season: string;
    tip: string;
    missing_types: string[];
    coverage_pct: number;
    coverage_detail: string;
    missing_tooltips: Array<{ type: string; suggestion: string; reason: string; searchQuery: string }>;
    transition_tip: string;
  };
  wardrobe_health: {
    total_items: number;
    items_worn_this_month: number;
    category_balance_score: number;
    color_diversity_score: number;
    cost_per_wear: number;
    cost_per_wear_trend: 'up' | 'down' | 'stable';
    score_breakdown: {
      category_balance: { score: number; detail: string; suggestion: string };
      color_diversity: { score: number; detail: string; suggestion: string };
    };
  };
  color_palette: ColorPaletteItem[];
  category_balance: CategoryBalanceItem[];
}

function computeWearStreak(wearLogs: Array<{ worn_at: string }>): number {
  if (!wearLogs || wearLogs.length === 0) return 0;
  const dates = Array.from(new Set(wearLogs.map((l) => l.worn_at)))
    .sort((a, b) => b.localeCompare(a));
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dates[0] === today || dates[0] === yesterday) {
    streak = 1;
    let checkDate = new Date(dates[0]);
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(checkDate.getTime() - 86400000);
      const prevStr = prevDate.toISOString().slice(0, 10);
      if (dates[i] === prevStr) {
        streak++;
        checkDate = prevDate;
      } else {
        break;
      }
    }
  }
  return streak;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cached = INSIGHTS_CACHE.get(user_id);
    if (cached && Date.now() - cached.ts < INSIGHTS_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = supabaseServer();

    // Fetch clothes
    const { data: clothesData, error: clothesError } = await supabase
      .from('clothes')
      .select('id, name, type, color, image_url, wear_count, season, price, unused_score, material, use_case')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available');

    if (clothesError) {
      console.error('Monthly insights clothes error:', clothesError);
      return NextResponse.json({ error: 'Failed to fetch clothes' }, { status: 500 });
    }

    const clothes: WearItem[] = (clothesData || []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color,
      image_url: c.image_url,
      wear_count: c.wear_count || 0,
      season: c.season,
      price: c.price,
      unused_score: c.unused_score,
      material: c.material || null,
      use_case: c.use_case || null,
    }));

    if (clothes.length < 5) {
      return NextResponse.json({
        insufficient_data: true,
        message: 'Add at least 5 items to unlock your monthly wardrobe insights',
        items_needed: 5 - clothes.length,
        greeting: (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })(),
        insufficient_items_text: `Add at least ${5 - clothes.length} more items to unlock your personalized wardrobe insights.`,
        insufficient_items_cta: '/wardrobe/upload',
        error_title: 'Could not load your wardrobe',
        error_button: 'Try Again',
      });
    }

    // Fetch ALL wear_logs for total counts
    const { data: allWearLogs } = await supabase
      .from('wear_logs')
      .select('cloth_id, worn_at')
      .eq('user_id', user_id);

    // Build total wear count per item (all time)
    const totalWearCount = new Map<string, number>();
    for (const log of allWearLogs || []) {
      totalWearCount.set(log.cloth_id, (totalWearCount.get(log.cloth_id) || 0) + 1);
    }

    // Fetch this month's and last month's boundaries
    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthStr = firstOfThisMonth.toISOString().slice(0, 10);
    const lastMonthStr = firstOfLastMonth.toISOString().slice(0, 10);

    // Build this month and last month wear maps
    const thisMonthWears = new Map<string, number>();
    const lastMonthWears = new Map<string, number>();

    for (const log of allWearLogs || []) {
      if (log.worn_at >= thisMonthStr) {
        thisMonthWears.set(log.cloth_id, (thisMonthWears.get(log.cloth_id) || 0) + 1);
      } else if (log.worn_at >= lastMonthStr) {
        lastMonthWears.set(log.cloth_id, (lastMonthWears.get(log.cloth_id) || 0) + 1);
      }
    }

    // Fetch streak logs (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const { data: streakLogs } = await supabase
      .from('wear_logs')
      .select('worn_at')
      .eq('user_id', user_id)
      .gte('worn_at', ninetyDaysAgo);

    const wearStreak = computeWearStreak(streakLogs || []);
    const itemsWornThisMonth = thisMonthWears.size;

    // Category balance
    const categoryCount = new Map<string, number>();
    for (const c of clothes) {
      categoryCount.set(c.type, (categoryCount.get(c.type) || 0) + 1);
    }
    const totalUnits = Array.from(categoryCount.values()).reduce((a, b) => a + b, 0) || 1;

    let balanceScore = 100;
    for (const [type, ideal] of Object.entries(IDEAL_RATIOS)) {
      const current = categoryCount.get(type) || 0;
      const idealCount = Math.max(1, Math.round((ideal / 6.5) * totalUnits));
      const ratio = current / idealCount;
      if (ratio < 0.5) balanceScore -= 15;
      else if (ratio < 0.8) balanceScore -= 5;
    }
    balanceScore = Math.max(0, balanceScore);

    // Color palette
    const colorCount = new Map<string, number>();
    for (const c of clothes) {
      if (c.color) {
        colorCount.set(c.color.toLowerCase(), (colorCount.get(c.color.toLowerCase()) || 0) + 1);
      }
    }
    const maxColorPct = Math.max(...Array.from(colorCount.values()).map((v) => v / clothes.length), 0);
    const colorDiversityScore = Math.round((1 - maxColorPct) * 100);

    const colorPalette: ColorPaletteItem[] = Array.from(colorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([color, count]) => ({
        color,
        hex: getColorHex(color),
        count,
        pct: Math.round((count / clothes.length) * 100),
      }));

    const categoryBalance: CategoryBalanceItem[] = Array.from(categoryCount.entries())
      .map(([type, count]) => {
        const ideal = Math.max(1, Math.round((IDEAL_RATIOS[type] || 1) / 6.5 * totalUnits));
        return { type, count, ideal, pct: Math.round((count / clothes.length) * 100) };
      })
      .sort((a, b) => b.count - a.count);

    // Cost per wear
    const itemsWithPrice = clothes.filter((c) => c.price != null);
    const priceSum = itemsWithPrice.reduce((s, c) => s + Number(c.price), 0);
    const avgPrice = itemsWithPrice.length > 0 ? priceSum / itemsWithPrice.length : 30;
    const totalValue = itemsWithPrice.length > 0
      ? priceSum + (clothes.length - itemsWithPrice.length) * avgPrice
      : clothes.length * 30;
    const totalWears = clothes.reduce((s, c) => s + (c.wear_count || 0), 0);
    const costPerWear = totalValue > 0 && totalWears > 0 ? totalValue / totalWears : 0;

    const thisMonthTotalWears = Array.from(thisMonthWears.values()).reduce((a, b) => a + b, 0);
    const lastMonthTotalWears = Array.from(lastMonthWears.values()).reduce((a, b) => a + b, 0);
    const costPerWearTrend: 'up' | 'down' | 'stable' =
      thisMonthTotalWears < lastMonthTotalWears * 0.8 ? 'up'
        : thisMonthTotalWears > lastMonthTotalWears * 1.2 ? 'down'
          : 'stable';

    // Seasonal
    const currentSeason = getCurrentSeason();
    const nextSeason = getNextSeason();
    const seasonItems = clothes.filter((c) => {
      if (!c.season) return true;
      const s = c.season.toLowerCase();
      return s.includes(currentSeason.toLowerCase()) || s.includes('all');
    });
    const coveragePct = Math.round((seasonItems.length / clothes.length) * 100);
    const seasonalTypes = new Set(seasonItems.map((c) => c.type));
    const missingTypes = Object.keys(IDEAL_RATIOS).filter((t) => !seasonalTypes.has(t));

    // Build missing type tooltips with suggestions + search links
    const SEASON_SUGGESTIONS: Record<string, Record<string, string>> = {
      Spring: { Tops: 'Light layers, cardigans, and long-sleeve tees', Bottoms: 'Jeans, chinos, or midi skirts', Outerwear: 'Light jackets, trench coats, or denim jackets', 'One-Piece': 'Dresses or jumpsuits in breathable fabrics' },
      Summer: { Tops: 'Tank tops, short-sleeve tees, and linen shirts', Bottoms: 'Shorts, lightweight skirts, or linen pants', Outerwear: 'Unstructured blazers, lightweight cardigans, or sun cover-ups', 'One-Piece': 'Sundresses, rompers, or swimwear cover-ups' },
      Fall: { Tops: 'Sweaters, hoodies, and flannel shirts', Bottoms: 'Dark jeans, corduroys, or wool trousers', Outerwear: 'Leather jackets, wool coats, or puffer vests', 'One-Piece': 'Long-sleeve dresses or knit jumpsuits' },
      Winter: { Tops: 'Thermal tops, turtlenecks, and fleece-lined layers', Bottoms: 'Heavy denim, wool pants, or lined leggings', Outerwear: 'Down coats, parkas, or wool overcoats', 'One-Piece': 'Knit dresses or fleece-lined overalls' },
    };

    const SEASON_SEARCH_QUERIES: Record<string, Record<string, string>> = {
      Spring: { Tops: 'spring tops women light layering', Bottoms: 'spring pants women chinos', Outerwear: 'spring jacket women light', 'One-Piece': 'spring dress women midi' },
      Summer: { Tops: 'summer tops women linen tank', Bottoms: 'shorts women summer', Outerwear: 'summer cardigan women light', 'One-Piece': 'sundress women summer' },
      Fall: { Tops: 'fall sweaters women cozy', Bottoms: 'fall pants women corduroy', Outerwear: 'fall coat women wool', 'One-Piece': 'fall dress women knit' },
      Winter: { Tops: 'winter turtleneck women thermal', Bottoms: 'winter pants women wool lined', Outerwear: 'winter coat women parka', 'One-Piece': 'winter dress women fleece' },
    };

    const missingTooltips = missingTypes.map((type) => ({
      type,
      suggestion: SEASON_SUGGESTIONS[currentSeason]?.[type] || `Look for ${type.toLowerCase()} suitable for ${currentSeason} weather`,
      reason: `You have no ${type.toLowerCase()} items rated for ${currentSeason}`,
      searchQuery: SEASON_SEARCH_QUERIES[currentSeason]?.[type] || `${currentSeason.toLowerCase()} ${type.toLowerCase()} women`,
    }));

    const coverageDetail = coveragePct < 40
      ? `Only ${seasonItems.length} of ${clothes.length} items suit ${currentSeason}. Your wardrobe needs significant seasonal coverage.`
      : coveragePct < 70
        ? `${seasonItems.length} of ${clothes.length} items suit ${currentSeason}. Good foundation, but a few key pieces would help.`
        : `${seasonItems.length} of ${clothes.length} items suit ${currentSeason}. You're well-prepared for the season.`;

    const transitionTip = (() => {
      const month = new Date().getMonth();
      const seasonStarts = { Spring: 2, Summer: 5, Fall: 8, Winter: 11 };
      const nextStart = seasonStarts[nextSeason as keyof typeof seasonStarts] ?? 0;
      const weeksUntil = Math.max(0, Math.round(((nextStart * 30 + 15) - (month * 30 + new Date().getDate())) / 7));
      if (weeksUntil <= 2) return `${nextSeason} is just ${weeksUntil} week${weeksUntil !== 1 ? 's' : ''} away — start transitioning now!`;
      if (weeksUntil <= 6) return `${nextSeason} starts in ~${weeksUntil} weeks. Gradually add ${nextSeason.toLowerCase()} pieces.`;
      return `Focus on ${currentSeason} for now. ${nextSeason} is ${weeksUntil} weeks away.`;
    })();

    // --- Parallel Gemini calls: seasonal tip + shopping list ---
    let geminiTip = '';
    const geminiKey = process.env.GEMINI_API_KEY;
    const shoppingList: MonthlyInsights['shopping_list'] = [];
    const topColor = [...colorCount.entries()].sort((a, b) => b[1] - a[1])[0];

    if (geminiKey) {
      // Build seasonal prompt (synchronous)
      const seasonalPrompt = `You are a minimalist wardrobe stylist. The user has ${clothes.length} items. ${seasonItems.length} suit ${currentSeason} (${coveragePct}% coverage). Missing types: ${missingTypes.join(', ') || 'none'}. Top items: ${seasonItems.slice(0, 5).map((c) => c.name).join(', ')}. Give 1-2 sentences of practical, specific seasonal advice. Be concise.`;

      // Fetch weather early for shopping prompt
      const weather = await fetchCurrentWeather().catch(() => null);

      // Build shopping prompt data (synchronous)
      const categorySummary = [...categoryCount.entries()]
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
      const topColors = [...colorCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([color, count]) => `${color} (${Math.round((count / clothes.length) * 100)}%)`)
        .join(', ');
      const useCaseSummary = (() => {
        const uc = new Map<string, number>();
        for (const c of clothes) {
          if (c.use_case && Array.isArray(c.use_case)) {
            for (const u of c.use_case) uc.set(u, (uc.get(u) || 0) + 1);
          }
        }
        return [...uc.entries()].sort((a, b) => b[1] - a[1]).map(([u, n]) => `${u}: ${n}`).join(', ');
      })();
      const wardrobeItems = clothes
        .slice(0, 30)
        .map((c) => `${c.name} (${c.color || 'unknown'}, ${c.type}, ${c.material || 'unknown material'}, ${c.season || 'all seasons'})`)
        .join('; ');

      const shoppingPrompt = `You are a personal wardrobe stylist. Recommend exactly 3 specific clothing items the user should buy.

Current season: ${currentSeason}
Weather: ${weather ? `${weather.temp}°C, ${weather.description}` : `${currentSeason} weather`}
Missing seasonal types: ${missingTypes.length > 0 ? missingTypes.join(', ') : 'none'}

User's wardrobe (${clothes.length} items):
Categories: ${categorySummary}
Colors: ${topColors}
Use cases: ${useCaseSummary || 'not tracked'}
Items: ${wardrobeItems}

For each recommendation, consider:
- What colors complement their existing wardrobe (avoid over-represented colors)
- What materials suit the current weather (${weather ? `${weather.temp}°C` : currentSeason})
- What use cases they wear most
- What category gaps exist

Return a JSON array of exactly 3 items:
[
  {
    "specific_name": "Camel Wool Blend Coat",
    "item_type": "Outerwear",
    "color": "Camel",
    "material": "Wool blend",
    "use_case": "business, casual",
    "search_query": "camel wool blend coat women"
  }
]

Rules:
- specific_name: Be specific (include color + material + style, e.g. "Navy Linen Button-Down Shirt")
- item_type: One of: Tops, Bottoms, Outerwear, One-Piece
- search_query: Optimized for shopping search (3-5 words)
- Return ONLY valid JSON array, no other text
- Exactly 3 items`;

      // Fire both Gemini calls in parallel
      const [seasonalResponse, shoppingResponse] = await Promise.all([
        callGeminiWithFallback(geminiKey, { contents: [{ parts: [{ text: seasonalPrompt }] }] }, 0),
        callGeminiWithFallback(geminiKey, { contents: [{ parts: [{ text: shoppingPrompt }] }] }, 0),
      ]);

      // Handle seasonal response
      if (seasonalResponse?.ok) {
        const data = await seasonalResponse.json();
        geminiTip = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      }

      // Handle shopping response
      if (shoppingResponse?.ok) {
        try {
          const data = await shoppingResponse.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          const jsonStr = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
          const recommendations = JSON.parse(jsonStr) as Array<{
            specific_name: string;
            item_type: string;
            color: string;
            material: string;
            use_case: string;
            search_query: string;
          }>;

          const seasonalSet = new Set(missingTypes);
          for (const rec of recommendations.slice(0, 3)) {
            let reasonCategory: 'seasonal_gap' | 'category_balance' | 'color_diversity' = 'category_balance';
            if (seasonalSet.has(rec.item_type)) {
              reasonCategory = 'seasonal_gap';
            } else if (rec.color && topColor && rec.color.toLowerCase() !== topColor[0].toLowerCase() && topColor[1] / clothes.length > 0.35) {
              reasonCategory = 'color_diversity';
            }

            const imageUrl = await searchPixabayImage(rec.search_query);

            shoppingList.push({
              item_type: rec.item_type,
              specific_name: rec.specific_name,
              color: rec.color,
              material: rec.material,
              use_case: rec.use_case,
              image_url: imageUrl,
              search_query: rec.search_query,
              priority: reasonCategory === 'seasonal_gap' ? 'high' : reasonCategory === 'color_diversity' ? 'low' : 'medium',
              reason_category: reasonCategory,
            });
          }
        } catch {
          // Fallback to generic list if Gemini fails
        }
      }
    }

    const seasonalTip = {
      season: currentSeason,
      next_season: nextSeason,
      tip: geminiTip || (coveragePct < 60
        ? `Only ${coveragePct}% of your wardrobe is suitable for ${currentSeason}.`
        : `You are well-covered for ${currentSeason}! Start thinking about ${nextSeason} transitions.`),
      missing_types: missingTypes,
      coverage_pct: coveragePct,
      coverage_detail: coverageDetail,
      missing_tooltips: missingTooltips,
      transition_tip: transitionTip,
    };

    // Compute score breakdown details
    const categoryBreakdown = (() => {
      const issues: string[] = [];
      const suggestions: string[] = [];
      for (const [type, ideal] of Object.entries(IDEAL_RATIOS)) {
        const current = categoryCount.get(type) || 0;
        const idealCount = Math.max(1, Math.round((ideal / 6.5) * totalUnits));
        if (current === 0) {
          issues.push(`no ${type.toLowerCase()}`);
          suggestions.push(`Add 1-2 ${type.toLowerCase()}`);
        } else if (current < idealCount * 0.5) {
          issues.push(`only ${current} ${type.toLowerCase()} (ideal: ${idealCount})`);
          suggestions.push(`Add ${idealCount - current} more ${type.toLowerCase()}`);
        } else if (current < idealCount * 0.8) {
          issues.push(`${current} ${type.toLowerCase()} (ideal: ${idealCount})`);
        }
      }
      const detail = issues.length > 0
        ? `Imbalances: ${issues.join(', ')}.`
        : 'All categories are well-balanced.';
      const suggestion = suggestions.length > 0
        ? suggestions.slice(0, 2).join('. ') + '.'
        : 'Your category mix looks good.';
      return { score: balanceScore, detail, suggestion };
    })();

    const colorBreakdown = (() => {
      const topColor = [...colorCount.entries()].sort((a, b) => b[1] - a[1])[0];
      const topColorName = topColor ? topColor[0] : 'unknown';
      const topColorPct = topColor ? Math.round((topColor[1] / clothes.length) * 100) : 0;
      const uniqueColors = colorCount.size;
      const detail = topColorPct > 40
        ? `${topColorPct}% of your wardrobe is ${topColorName}. This limits outfit variety.`
        : `Your most common color is ${topColorName} (${topColorPct}%). You have ${uniqueColors} unique colors.`;
      const suggestion = topColorPct > 40
        ? `Adding items in complementary colors (not ${topColorName}) would improve diversity.`
        : uniqueColors < 5
          ? 'Adding 2-3 more colors would increase outfit options.'
          : 'Your color palette is well-diversified.';
      return { score: colorDiversityScore, detail, suggestion };
    })();

    const wardrobeHealth: MonthlyInsights['wardrobe_health'] = {
      total_items: clothes.length,
      items_worn_this_month: itemsWornThisMonth,
      category_balance_score: balanceScore,
      color_diversity_score: colorDiversityScore,
      cost_per_wear: Math.round(costPerWear * 100) / 100,
      cost_per_wear_trend: costPerWearTrend,
      score_breakdown: {
        category_balance: categoryBreakdown,
        color_diversity: colorBreakdown,
      },
    };

    // Fallback: generic shopping list if Gemini didn't produce results
    if (shoppingList.length === 0) {
      const alreadyInList = new Set<string>();
      for (const type of missingTypes) {
        alreadyInList.add(type);
        shoppingList.push({
          item_type: type,
          specific_name: `${currentSeason} ${type}`,
          color: 'Essential',
          material: 'Various',
          use_case: 'casual',
          image_url: null,
          search_query: SEASON_SEARCH_QUERIES[currentSeason]?.[type] || `${currentSeason.toLowerCase()} ${type.toLowerCase()} women`,
          priority: 'high',
          reason_category: 'seasonal_gap',
        });
      }
      for (const [type, ideal] of Object.entries(IDEAL_RATIOS)) {
        if (alreadyInList.has(type)) continue;
        const current = categoryCount.get(type) || 0;
        const idealCount = Math.max(1, Math.round((ideal / 6.5) * totalUnits));
        if (current < idealCount * 0.7) {
          alreadyInList.add(type);
          shoppingList.push({
            item_type: type,
            specific_name: `${type} for ${currentSeason}`,
            color: 'Neutral',
            material: 'Various',
            use_case: 'casual',
            image_url: null,
            search_query: `${type.toLowerCase().replace('-', ' ')} women ${currentSeason.toLowerCase()}`,
            priority: current === 0 ? 'high' : 'medium',
            reason_category: 'category_balance',
          });
        }
      }
      const topC = [...colorCount.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topC && topC[1] / clothes.length > 0.4) {
        shoppingList.push({
          item_type: 'Tops',
          specific_name: 'Colorful Tops',
          color: 'Complementary',
          material: 'Various',
          use_case: 'casual',
          image_url: null,
          search_query: `women tops colorful non ${topC[0]}`,
          priority: 'low',
          reason_category: 'color_diversity',
        });
      }

      // Fetch images from Pixabay for all fallback items
      for (const item of shoppingList) {
        item.image_url = await searchPixabayImage(item.search_query);
      }
    }

    // MOST WORN: items with highest wear this month (with total as fallback)
    const mostWorn = clothes
      .map((c) => ({
        item_id: c.id,
        name: c.name,
        image_url: c.image_url,
        type: c.type,
        times_worn_this_month: thisMonthWears.get(c.id) || 0,
        total_wears: totalWearCount.get(c.id) || c.wear_count || 0,
      }))
      .sort((a, b) => (b.times_worn_this_month || b.total_wears) - (a.times_worn_this_month || a.total_wears))
      .filter((c) => c.total_wears > 0)
      .slice(0, 3);

    // WEAR MORE: items with lowest wear this month (must have at least 1 total wear)
    const wearMore = clothes
      .map((c) => ({
        item_id: c.id,
        name: c.name,
        image_url: c.image_url,
        type: c.type,
        reason: (thisMonthWears.get(c.id) || 0) === 0
          ? 'Not worn yet this month'
          : `Only worn ${thisMonthWears.get(c.id)} time${(thisMonthWears.get(c.id) || 0) > 1 ? 's' : ''}`,
        suggested_combo: `Try styling your ${c.name} differently`,
        times_worn_this_month: thisMonthWears.get(c.id) || 0,
        total_wears: totalWearCount.get(c.id) || c.wear_count || 0,
      }))
      .filter((c) => c.total_wears > 0)
      .sort((a, b) => a.times_worn_this_month - b.times_worn_this_month)
      .slice(0, 3);

    // Template text (no Gemini needed)
    const topColorPct = topColor ? Math.round((topColor[1] / clothes.length) * 100) : 0;

    const summary = mostWorn.length > 0
      ? `You wore ${itemsWornThisMonth} of your ${clothes.length} items this month. Your go-to piece was the ${mostWorn[0].name}.`
      : `You wore ${itemsWornThisMonth} of your ${clothes.length} items this month.`;

    const funFact = topColor
      ? `Your most common color is ${topColor[0]} at ${topColorPct}% of your wardrobe.`
      : `You have ${clothes.length} items in your wardrobe.`;

    const costPerWearTrendText = costPerWearTrend === 'down' ? 'improving' : costPerWearTrend === 'up' ? 'increasing' : 'stable';

    const result: MonthlyInsights = {
      greeting: (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })(),
      month_theme: `${currentSeason} Wardrobe Report`,
      headline: (() => { const overallHealth = Math.round((balanceScore + colorDiversityScore) / 2); return `Your wardrobe is ${overallHealth}% optimized for the current season.`; })(),
      summary,
      fun_fact: funFact,
      wear_streak: wearStreak,
      wear_streak_text: wearStreak > 0 ? `${wearStreak} day wear streak` : '',
      items_in_wardrobe_text: `${clothes.length} items in wardrobe`,
      cost_per_wear_trend_text: costPerWearTrendText,
      empty_outfit_text: 'No outfit suggestion available. Add more items to get recommendations.',
      empty_outfit_cta: '/wardrobe/upload',
      insufficient_items_text: `Add at least ${5 - clothes.length > 0 ? 5 - clothes.length : 5} more items to unlock your personalized wardrobe insights.`,
      insufficient_items_cta: '/wardrobe/upload',
      error_title: 'Could not load your wardrobe',
      error_button: 'Try Again',
      wear_more: wearMore,
      most_worn: mostWorn,
      shopping_list: shoppingList.slice(0, 3),
      seasonal_tip: seasonalTip,
      wardrobe_health: wardrobeHealth,
      color_palette: colorPalette,
      category_balance: categoryBalance,
    };

    INSIGHTS_CACHE.set(user_id, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API /api/wardrobe/monthly-insights crashed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Error' },
      { status: 500 }
    );
  }
}
