import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';
import { callGeminiWithFallback } from '@/lib/gemini';

const STORY_CACHE = new Map<string, { data: unknown; ts: number }>();
const STORY_CACHE_TTL = 24 * 60 * 60 * 1000;

const IMPACT_ESTIMATES = {
  donate: { co2_kg: 3.5, water_l: 2000, money: 15 },
  sell: { co2_kg: 2.5, water_l: 1500, money: 25 },
  recycle: { co2_kg: 1.5, water_l: 500, money: 5 },
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const cached = STORY_CACHE.get(userId);
    if (cached && Date.now() - cached.ts < STORY_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = supabaseServer();

    const [clothesResult, pledgesResult] = await Promise.all([
      supabase
        .from('clothes')
        .select('id, status')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or('status.is.null,status.eq.available'),
      supabase
        .from('pledges')
        .select('id, action_type, status, item_ids')
        .eq('user_id', userId),
    ]);

    const clothes = clothesResult.data || [];
    const pledges = pledgesResult.data || [];

    const fulfilledPledges = pledges.filter((p) => p.status === 'fulfilled');
    const itemsDiverted = fulfilledPledges.reduce(
      (sum, p) => sum + (p.item_ids?.length || 0),
      0,
    );

    const byAction: Record<string, number> = { donate: 0, sell: 0, recycle: 0 };
    let totalCo2 = 0;
    let totalWater = 0;
    let totalMoney = 0;

    for (const action of ['donate', 'sell', 'recycle'] as const) {
      const count = fulfilledPledges
        .filter((p) => p.action_type === action)
        .reduce((s, p) => s + (p.item_ids?.length || 0), 0);
      byAction[action] = count;
      const est = IMPACT_ESTIMATES[action];
      totalCo2 += count * est.co2_kg;
      totalWater += count * est.water_l;
      totalMoney += count * est.money;
    }

    const impact = {
      co2_saved_kg: Math.round(totalCo2 * 10) / 10,
      water_saved_l: totalWater,
      items_diverted: itemsDiverted,
      equivalent_trees: Math.round(totalCo2 / 21),
      money_saved: totalMoney,
    };

    const sustainabilityRate =
      clothes.length + itemsDiverted > 0
        ? Math.round((itemsDiverted / (clothes.length + itemsDiverted)) * 100)
        : 0;

    // Try Gemini for a personalized sustainability story
    let story = '';
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const prompt = `You are a sustainability coach. Write exactly 1 sentence (max 20 words) about this user's environmental impact from reusing clothing. Highlight their most impressive stat. Be sharp, not fluffy. If 0 items diverted, write 1 sentence encouraging action.

Items diverted: ${itemsDiverted}
CO₂ saved: ${impact.co2_saved_kg}kg | Water saved: ${impact.water_saved_l.toLocaleString()}L | Trees equivalent: ${impact.equivalent_trees}
Actions: ${byAction.donate} donations, ${byAction.sell} resales, ${byAction.recycle} recyclings`;

        const { response } = await callGeminiWithFallback(geminiKey, {
          contents: [{ parts: [{ text: prompt }] }],
        }, 0);
        if (response?.ok) {
          const data = await response.json();
          story = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        }
      } catch {
        // Use fallback
      }
    }

    if (!story) {
      story =
        itemsDiverted === 0
          ? `You haven't diverted any items yet. Visit the Pre-Loved page to give your unused clothes a second life and start making an environmental impact.`
          : `You've diverted ${itemsDiverted} item${itemsDiverted !== 1 ? 's' : ''} from landfill, saving ${impact.co2_saved_kg} kg of CO₂ and ${impact.water_saved_l.toLocaleString()} liters of water. Every item counts — keep up the great work!`;
    }

    const responseData = { story, impact, sustainability_rate: sustainabilityRate };
    STORY_CACHE.set(userId, { data: responseData, ts: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('API /api/wardrobe/sustainability-story crashed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Error' },
      { status: 500 },
    );
  }
}
