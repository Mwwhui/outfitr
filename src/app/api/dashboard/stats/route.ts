import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';
import { callGeminiWithFallback } from '@/lib/gemini';

const supabase = supabaseServer();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const now = new Date();
    const firstOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const twelveMonthsAgo = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      1,
    ).toISOString();

    const [
      clothesResult,
      pledgesResult,
      itemsOverTimeResult,
      pledgesOverTimeResult,
      recentResult,
      wearLogsResult,
    ] = await Promise.all([
      supabase
        .from('clothes')
        .select(
          'id, name, type, brand, material, price, wear_count, image_url, created_at, status',
        )
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or('status.is.null,status.eq.available'),
      supabase
        .from('pledges')
        .select('id, action_type, status, item_ids, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('clothes')
        .select('created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or('status.is.null,status.eq.available')
        .gte('created_at', twelveMonthsAgo)
        .order('created_at', { ascending: true }),
      supabase
        .from('pledges')
        .select('status, created_at')
        .eq('user_id', userId)
        .gte('created_at', twelveMonthsAgo)
        .order('created_at', { ascending: true }),
      supabase
        .from('pledges')
        .select('id, action_type, status, item_ids, created_at, partner_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('wear_logs')
        .select('cloth_id, worn_at')
        .eq('user_id', userId)
        .gte('worn_at', twelveMonthsAgo),
    ]);

    const clothes = clothesResult.data || [];
    const pledges = pledgesResult.data || [];
    const itemsTimeData = itemsOverTimeResult.data || [];
    const pledgesTimeData = pledgesOverTimeResult.data || [];
    const recentPledges = recentResult.data || [];
    const wearLogs = wearLogsResult.data || [];

    const itemsWithPrice = clothes.filter(
      (c: { price: number | null }) => c.price != null,
    );
    const itemsWithoutPrice = clothes.length - itemsWithPrice.length;
    const priceSum = itemsWithPrice.reduce(
      (s: number, c: { price: number }) => s + Number(c.price),
      0,
    );
    const avgPrice =
      itemsWithPrice.length > 0
        ? Math.round(priceSum / itemsWithPrice.length)
        : 0;
    const totalValue =
      itemsWithPrice.length > 0
        ? priceSum + itemsWithoutPrice * avgPrice
        : clothes.length * 30;

    const totalWears = clothes.reduce(
      (s: number, c: { wear_count: number | null }) => s + (c.wear_count || 0),
      0,
    );

    const wardrobe = {
      total_value: totalValue,
      average_value: avgPrice || 30,
      items_with_price: itemsWithPrice.length,
      items_without_price: itemsWithoutPrice,
      total_wears: totalWears,
      cost_per_wear:
        totalValue > 0 && totalWears > 0
          ? Math.round((totalValue / totalWears) * 100) / 100
          : 0,
      replacement_saved: totalWears > 0 ? totalWears * (avgPrice || 30) : 0,
    };

    const sortedByWear = [...clothes]
      .filter((c: { wear_count: number | null }) => (c.wear_count || 0) > 0)
      .sort((a, b) => (b.wear_count || 0) - (a.wear_count || 0));

    const mostWorn = sortedByWear
      .slice(0, 3)
      .map(
        (item: {
          id: string;
          name: string;
          type: string;
          wear_count: number | null;
          image_url: string | null;
        }) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          wear_count: item.wear_count || 0,
          image_url: item.image_url,
        }),
      );

    const leastWorn = [...clothes]
      .filter((c: { wear_count: number | null }) => (c.wear_count || 0) === 0)
      .slice(0, 3)
      .map(
        (item: {
          id: string;
          name: string;
          type: string;
          wear_count: number | null;
          image_url: string | null;
        }) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          wear_count: 0,
          image_url: item.image_url,
        }),
      );

    const fulfilledItemCount = pledges
      .filter((p: { status: string }) => p.status === 'fulfilled')
      .reduce(
        (sum: number, p: { item_ids: string[] }) =>
          sum + (p.item_ids?.length || 0),
        0,
      );

    const totals = {
      items: clothes.length,
      items_this_month: clothes.filter(
        (c: { created_at: string }) => c.created_at >= firstOfMonth,
      ).length,
      pledges_total: pledges.length,
      pledges_pending: pledges.filter(
        (p: { status: string }) => p.status === 'pending',
      ).length,
      pledges_accepted: pledges.filter(
        (p: { status: string }) => p.status === 'accepted',
      ).length,
      pledges_fulfilled: pledges.filter(
        (p: { status: string }) => p.status === 'fulfilled',
      ).length,
      pledges_rejected: pledges.filter(
        (p: { status: string }) => p.status === 'rejected',
      ).length,
      fulfilled_change_pct: 0,
      sustainability_rate:
        clothes.length + fulfilledItemCount > 0
          ? Math.round(
              (fulfilledItemCount / (clothes.length + fulfilledItemCount)) *
                100,
            )
          : 0,
    };

    if (totals.pledges_fulfilled > 0) {
      const lastMonthStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      ).toISOString();
      const lastMonthEnd = firstOfMonth;
      const prevFulfilled = pledges.filter(
        (p: { status: string; created_at: string }) =>
          p.status === 'fulfilled' &&
          p.created_at >= lastMonthStart &&
          p.created_at < lastMonthEnd,
      ).length;
      totals.fulfilled_change_pct =
        prevFulfilled > 0
          ? Math.round(
              ((totals.pledges_fulfilled - prevFulfilled) / prevFulfilled) *
                100,
            )
          : 100;
    }

    const IMPACT_ESTIMATES = {
      donate: { co2_kg: 3.5, water_l: 2000, money: 15 },
      sell: { co2_kg: 2.5, water_l: 1500, money: 25 },
      recycle: { co2_kg: 1.5, water_l: 500, money: 5 },
    };

    const fulfilledPledges = pledges.filter(
      (p: { status: string }) => p.status === 'fulfilled',
    );
    const itemsDiverted = fulfilledPledges.reduce(
      (sum: number, p: { item_ids: string[] }) =>
        sum + (p.item_ids?.length || 0),
      0,
    );

    const impactByAction: Record<
      string,
      { count: number; co2_kg: number; water_l: number; money: number }
    > = {};
    let totalCo2 = 0;
    let totalWater = 0;
    let totalMoney = 0;

    for (const action of ['donate', 'sell', 'recycle']) {
      const pledgesOfAction = fulfilledPledges.filter(
        (p: { action_type: string }) => p.action_type === action,
      );
      const count = pledgesOfAction.reduce(
        (s: number, p: { item_ids: string[] }) => s + (p.item_ids?.length || 0),
        0,
      );
      const estimates =
        IMPACT_ESTIMATES[action as keyof typeof IMPACT_ESTIMATES];
      const co2 = Math.round(count * estimates.co2_kg * 10) / 10;
      const water = count * estimates.water_l;
      const money = count * estimates.money;
      impactByAction[action] = { count, co2_kg: co2, water_l: water, money };
      totalCo2 += co2;
      totalWater += water;
      totalMoney += money;
    }

    const impact = {
      co2_saved_kg: totalCo2,
      water_saved_l: totalWater,
      items_diverted: itemsDiverted,
      equivalent_trees: Math.round(totalCo2 / 21),
      money_saved: totalMoney,
      by_action: impactByAction,
    };

    const brandCount = new Map<string, number>();
    const materialCount = new Map<string, number>();
    const categoryCount = new Map<string, number>();

    for (const item of clothes) {
      if (item.brand)
        brandCount.set(item.brand, (brandCount.get(item.brand) || 0) + 1);
      if (item.material)
        materialCount.set(
          item.material,
          (materialCount.get(item.material) || 0) + 1,
        );
      const catName = item.type || 'Uncategorized';
      categoryCount.set(catName, (categoryCount.get(catName) || 0) + 1);
    }

    const CATEGORY_COLORS: Record<string, string> = {
      Tops: '#d97706',
      Bottoms: '#2563eb',
      Outerwear: '#7c3aed',
      'One-Piece': '#059669',
      Uncategorized: '#9ca3af',
    };
    const categoryColorFallback = '#163422';

    const colors = [
      '#163422',
      '#d97706',
      '#2563eb',
      '#7c3aed',
      '#059669',
      '#dc2626',
      '#0891b2',
      '#ca8a04',
    ];

    const categoryData = Array.from(categoryCount.entries())
      .map(([name, count]) => ({
        name,
        count,
        color: CATEGORY_COLORS[name] || categoryColorFallback,
      }))
      .sort((a, b) => b.count - a.count);

    const brandData = Array.from(brandCount.entries())
      .map(([name, count], i) => ({
        name,
        count,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const materialData = Array.from(materialCount.entries())
      .map(([name, count], i) => ({
        name: name || 'Unknown',
        count,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.count - a.count);

    function groupByMonth<T>(
      data: T[],
      dateKey: keyof T,
      valueKey?: keyof T,
    ): { month: string; count: number }[] {
      const months = new Map<string, number>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.set(key, 0);
      }
      for (const item of data) {
        const d = new Date(item[dateKey] as string);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (months.has(key)) {
          months.set(key, (months.get(key) || 0) + 1);
        }
      }
      return Array.from(months.entries()).map(([month, count]) => ({
        month,
        count,
      }));
    }

    const itemsOverTime = groupByMonth(itemsTimeData, 'created_at');

    const pledgeStatusOrder = ['pending', 'accepted', 'fulfilled', 'rejected'];
    const pledgeMonths = new Map<
      string,
      { pending: number; accepted: number; fulfilled: number }
    >();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      pledgeMonths.set(key, { pending: 0, accepted: 0, fulfilled: 0 });
    }
    for (const p of pledgesTimeData) {
      const d = new Date(p.created_at as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = pledgeMonths.get(key);
      if (entry && p.status !== 'rejected') {
        if (p.status === 'pending') entry.pending++;
        else if (p.status === 'accepted') entry.accepted++;
        else if (p.status === 'fulfilled') entry.fulfilled++;
      }
    }
    const pledgesOverTime = Array.from(pledgeMonths.entries()).map(
      ([month, counts]) => ({
        month,
        ...counts,
      }),
    );

    const statusBreakdown = pledgeStatusOrder.map((status) => ({
      status,
      count: pledges.filter((p: { status: string }) => p.status === status)
        .length,
    }));

    const actionTypes = ['donate', 'sell', 'recycle'];
    const actionTypeData = actionTypes.map((type) => ({
      type,
      count: pledges.filter(
        (p: { action_type: string }) => p.action_type === type,
      ).length,
    }));

    const partnerIds = recentPledges
      .filter((p: { partner_id: string | null }) => p.partner_id)
      .map((p: { partner_id: string }) => p.partner_id);

    let partnerNames = new Map<string, string>();
    if (partnerIds.length > 0) {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, name')
        .in('id', partnerIds);
      if (partners) {
        partnerNames = new Map(
          partners.map((p: { id: string; name: string }) => [p.id, p.name]),
        );
      }
    }

    const recentActivity = recentPledges.map(
      (p: {
        id: string;
        action_type: string;
        status: string;
        item_ids: string[];
        created_at: string;
        partner_id: string | null;
      }) => ({
        pledge_id: p.id,
        partner_name: p.partner_id
          ? partnerNames.get(p.partner_id) || 'Unknown Partner'
          : 'Unknown Partner',
        action_type: p.action_type,
        status: p.status,
        item_count: p.item_ids?.length || 0,
        created_at: p.created_at,
      }),
    );

    // Wearing habits — monthly wears
    const wearMonths = new Map<string, { wears: number; items: Set<string> }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      wearMonths.set(key, { wears: 0, items: new Set() });
    }
    for (const log of wearLogs) {
      const d = new Date(log.worn_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (wearMonths.has(key)) {
        const entry = wearMonths.get(key)!;
        entry.wears++;
        entry.items.add(log.cloth_id);
      }
    }

    const wearsOverTime = Array.from(wearMonths.entries()).map(
      ([month, data]) => ({
        month,
        wears: data.wears,
        items_worn: data.items.size,
      }),
    );

    const wearEntries = Array.from(wearMonths.entries());
    const thisMonthWears =
      wearEntries.length > 0 ? wearEntries[wearEntries.length - 1][1].wears : 0;
    const lastMonthWears =
      wearEntries.length > 1 ? wearEntries[wearEntries.length - 2][1].wears : 0;
    const wearChangePct =
      lastMonthWears > 0
        ? Math.round(((thisMonthWears - lastMonthWears) / lastMonthWears) * 100)
        : thisMonthWears > 0
          ? 100
          : 0;

    // Gemini AI wearing insight
    let wearingInsight = '';
    const geminiKey = process.env.GEMINI_API_KEY;
    const hasWearData = wearsOverTime.some((m) => m.wears > 0);
    if (geminiKey && hasWearData) {
      try {
        const monthsSummary = wearsOverTime
          .slice(-6)
          .map((m) => {
            const label = new Date(m.month + '-01').toLocaleDateString(
              'en-US',
              { month: 'short', year: 'numeric' },
            );
            return `${label}: ${m.wears} wears, ${m.items_worn} items`;
          })
          .join(', ');

        const prompt = `You are a wardrobe analyst. The user's wearing habits over the last 6 months: ${monthsSummary}. Current month: ${thisMonthWears} wears, previous month: ${lastMonthWears} wears (${wearChangePct >= 0 ? '+' : ''}${wearChangePct}% change). Give 1-2 sentences of personalized insight about their wearing patterns and a practical recommendation. Be concise.`;

        const response = await callGeminiWithFallback(geminiKey, {
          contents: [{ parts: [{ text: prompt }] }],
        });
        if (response?.ok) {
          const data = await response.json();
          wearingInsight =
            data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        }
      } catch {
        // Use fallback below
      }
    }

    if (!wearingInsight) {
      if (!hasWearData) {
        wearingInsight =
          'Start logging outfits in the Planner to see your wearing habits and get personalized insights.';
      } else if (wearChangePct > 20) {
        wearingInsight = `You're wearing your clothes ${wearChangePct}% more this month than last — great rotation! Keep exploring new combinations.`;
      } else if (wearChangePct < -20) {
        wearingInsight = `Your wear count dropped ${Math.abs(wearChangePct)}% this month. Try styling a few items you haven't worn lately to refresh your rotation.`;
      } else {
        wearingInsight =
          'Your wearing habits are consistent month over month. Try experimenting with new outfit combinations to keep things fresh.';
      }
    }

    return NextResponse.json({
      totals,
      categories: categoryData,
      brands: brandData,
      materials: materialData,
      items_over_time: itemsOverTime,
      pledges_over_time: pledgesOverTime,
      status_breakdown: statusBreakdown,
      action_types: actionTypeData,
      recent_activity: recentActivity,
      impact,
      wardrobe,
      most_worn: mostWorn,
      least_worn: leastWorn,
      wears_over_time: wearsOverTime,
      wearing_insight: wearingInsight,
      this_month_wears: thisMonthWears,
      last_month_wears: lastMonthWears,
      wear_change_pct: wearChangePct,
    });
  } catch (err) {
    console.error('GET /api/dashboard/stats error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
