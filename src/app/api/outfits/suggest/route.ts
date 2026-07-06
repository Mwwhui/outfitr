import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';
import { suggestOutfits } from '@/lib/suggestOutfits';
import { callGeminiWithFallback } from '@/lib/gemini';

export const maxDuration = 30;

// In-memory cache with 1-day TTL
const SUGGEST_CACHE = new Map<string, { data: unknown; ts: number }>();
const SUGGEST_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day

// POST /api/outfits/suggest
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

    const body = await req.json().catch(() => ({}));
    const weather = body.weather || null;
    const occasion = body.occasion || 'casual';
    const seedItemIds = body.seedItemIds || [];

    // Cache key includes occasion so weather/calendar changes trigger fresh suggestions
    const cacheKey = `${user_id}::${occasion}`;
    const cached = SUGGEST_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < SUGGEST_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = supabaseServer();

    // Fetch clothes
    const { data: clothes } = await supabase
      .from('clothes')
      .select('*')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available');

    if (!clothes || clothes.length < 3) {
      return NextResponse.json({
        suggestions: [],
        message: 'Need at least 3 items for suggestions',
      });
    }

    // Fetch wear_logs for pair frequency
    const { data: wearLogs } = await supabase
      .from('wear_logs')
      .select('cloth_id, worn_at, time_slot')
      .eq('user_id', user_id);

    // Build pair frequency
    const outfitGroups = new Map<string, string[]>();
    for (const log of wearLogs || []) {
      const key = `${log.worn_at}::${log.time_slot}`;
      const group = outfitGroups.get(key) || [];
      group.push(log.cloth_id);
      outfitGroups.set(key, group);
    }

    const pairFreq: Record<string, number> = {};
    for (const group of outfitGroups.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const pair = [group[i], group[j]].sort().join(':');
          pairFreq[pair] = (pairFreq[pair] || 0) + 1;
        }
      }
    }

    // Fetch existing outfit plans to filter out already-worn combos
    const { data: existingPlans } = await supabase
      .from('outfit_plans')
      .select('slots')
      .eq('user_id', user_id);

    // Build valid item IDs from current wardrobe (clothes already filtered for deleted)
    const validItemIds = new Set((clothes || []).map((c) => c.id));

    const wornCombos = new Set<string>();
    for (const plan of existingPlans || []) {
      if (!plan.slots || typeof plan.slots !== 'object') continue;
      const ids: string[] = [];
      for (const val of Object.values(plan.slots)) {
        if (val && typeof val === 'object' && 'id' in val) {
          const id = (val as { id: string }).id;
          if (validItemIds.has(id)) {
            ids.push(id);
          }
        }
      }
      if (ids.length >= 2) {
        wornCombos.add(ids.sort().join('::'));
      }
    }

    // Generate suggestions using weather + occasion context
    const suggestions = suggestOutfits(
      clothes,
      weather,
      occasion,
      pairFreq,
      seedItemIds,
    );

    // Filter out already-worn combos and take top 5
    const fresh = suggestions
      .filter((s) => {
        const ids = s.items
          .map((i) => i.id)
          .sort()
          .join('::');
        return !wornCombos.has(ids);
      })
      .slice(0, 5);

    if (fresh.length === 0) {
      return NextResponse.json({
        suggestions: [],
        message: 'All combinations have been worn! Try something new.',
      });
    }

    // Send to Gemini for reasoning
    const comboDescriptions = fresh.map((s, i) => {
      const itemNames = s.items.map(
        (it) => `${it.name} (${it.color || 'no color'}, ${it.type})`,
      );
      return `Combo ${i + 1}: ${itemNames.join(' + ')}`;
    });

    const prompt = `You are a minimalist wardrobe stylist. Analyze these outfit combinations and explain why each works.

COMBOS:
${comboDescriptions.join('\n')}

For each combo, determine:
1. A brief reasoning (1 sentence) explaining why it works
2. Whether it's "safe" (follows the user's usual patterns) or "adventurous" (breaks their routine)

Return ONLY valid JSON array:
[
  { "index": 0, "reasoning": "...", "style": "safe" | "adventurous" },
  ...
]`;

    const response = await callGeminiWithFallback(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
    }, 0);

    let aiReasoning: Array<{
      index: number;
      reasoning: string;
      style: string;
    }> = [];
    if (response?.ok) {
      const data = await response.json();
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      try {
        const jsonStr = text
          .replace(/```json?\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        aiReasoning = JSON.parse(jsonStr);
      } catch {
        // Use fallback reasoning
      }
    }

    // Merge AI reasoning with suggestions
    const result = fresh.map((s, i) => {
      const ai = aiReasoning.find((r) => r.index === i);
      return {
        items: s.items.map((it) => ({
          id: it.id,
          name: it.name,
          type: it.type,
          color: it.color || null,
          image_url: it.image_url || null,
        })),
        score: s.score,
        ai_reasoning:
          ai?.reasoning ||
          `${s.items.map((it) => it.name).join(' + ')} — scored ${s.score}/100`,
        style: ai?.style || 'safe',
        color_harmony:
          // ScoreBreakdown may not have a typed 'value' property here — fallback safely
          (s.breakdown?.find((b) => b.label === 'Color Harmony') as any)
            ?.value ?? 0,
      };
    });

    // Cache the result (1-day TTL)
    const responseData = { suggestions: result };
    SUGGEST_CACHE.set(cacheKey, { data: responseData, ts: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('API /api/outfits/suggest crashed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Error' },
      { status: 500 },
    );
  }
}
