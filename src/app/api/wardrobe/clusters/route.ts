import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';
import { kMeans } from '@/lib/kmeans';
import { normalizeColor } from '@/lib/colorNorm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface RawItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  season: string | null;
  image_url: string | null;
  price: number | null;
  wear_count: number | null;
  unused_score: number | null;
  unused: boolean | null;
  brand: string | null;
  material: string | null;
  purchase_date: string | null;
  created_at: string;
}

interface ClusterItem {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
  wear_count: number;
  price: number;
}

interface ClusterInsight {
  totalValue: number;
  avgWear: number;
  avgPrice: number;
  wearVsAverage: number;
  typeBreakdown: { type: string; count: number; percentage: number }[];
}

interface ClusterGroup {
  id: number;
  label: string;
  color: string;
  size: number;
  insight: ClusterInsight;
  items: ClusterItem[];
}

interface ClusterResponse {
  clusters: ClusterGroup[];
  message?: string;
}

// ─── Normalisation ────────────────────────────────────────────────────────────
// min-max scales each dimension to [0,1] based on actual observed range.
// When all values are identical (range=0), returns 0.5 so the dimension
// contributes zero distance rather than NaN.
// Non-finite values are filtered out when computing min/max and mapped to 0.5.
function minmax(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const clean = arr.filter((v) => isFinite(v));
  if (clean.length === 0) return arr.map(() => 0.5);
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min;
  if (range === 0) return arr.map(() => 0.5);
  return arr.map((v) => (isFinite(v) ? (v - min) / range : 0.5));
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '')
    return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

// ─── Label assignment ─────────────────────────────────────────────────────────
//
// Feature dimensions (all in [0,1] after min-max):
//   [0] wear       — higher = worn more often          ← KEY signal
//   [1] cpw        — higher = expensive per wear       (pricey but rarely worn)
//   [2] unused     — higher = more neglected
//   [3] age        — higher = owned longer
//
// Scoring is relative: greedy best-match ensures every cluster gets a
// distinct label regardless of the absolute centroid values.

function assignLabels(
  centroids: number[][],
): { label: string; color: string }[] {
  const catalog: {
    label: string;
    color: string;
    score: (c: number[]) => number;
  }[] = [
    {
      label: 'Keep in Rotation',
      color: '#16a34a',
      // High wear, low neglect
      score: (c) => c[0] * 2 - c[2],
    },
    {
      label: 'Save for Occasions',
      color: '#d97706',
      // High cost-per-wear (pricey, rarely worn) but NOT neglected — intentional
      score: (c) => c[1] * 2 - c[0] - c[2] * 0.5,
    },
    {
      label: 'Ready to Let Go',
      color: '#dc2626',
      // Low wear + high neglect + old
      score: (c) => c[2] * 1.5 + c[3] * 0.5 - c[0] * 2,
    },
    {
      label: 'Everyday Essentials',
      color: '#2563eb',
      // The "average" cluster — wins when none of the above strongly apply
      score: (c) =>
        -(Math.abs(c[0] - 0.5) + Math.abs(c[1] - 0.5) + Math.abs(c[2] - 0.5)),
    },
  ];

  const k = centroids.length;
  const result = new Array<{ label: string; color: string }>(k);
  const usedLabels = new Set<number>();
  const usedCentroids = new Set<number>();

  const pairs: { li: number; ci: number; score: number }[] = [];
  for (let li = 0; li < catalog.length; li++) {
    for (let ci = 0; ci < k; ci++) {
      pairs.push({ li, ci, score: catalog[li].score(centroids[ci]) });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  for (const { li, ci } of pairs) {
    if (usedLabels.has(li) || usedCentroids.has(ci)) continue;
    result[ci] = { label: catalog[li].label, color: catalog[li].color };
    usedLabels.add(li);
    usedCentroids.add(ci);
    if (usedCentroids.size === k) break;
  }

  for (let ci = 0; ci < k; ci++) {
    if (!result[ci])
      result[ci] = { label: 'Everyday Essentials', color: '#2563eb' };
  }
  return result;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    console.log('Clusters: userId', userId, 'session', !!session);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: clothes, error } = await supabase
      .from('clothes')
      .select(
        'id, name, type, color, season, image_url, price, wear_count, unused_score, unused, brand, material, purchase_date, created_at',
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available');
    console.log('Clusters: clothes count', clothes?.length, 'error', error);

    if (error || !clothes) {
      return NextResponse.json(
        { error: 'Failed to fetch clothes' },
        { status: 500 },
      );
    }

    const items = clothes as RawItem[];

    if (items.length < 5) {
      return NextResponse.json({
        clusters: [],
        message: 'Add at least 5 items to see your wardrobe clusters.',
      } satisfies ClusterResponse);
    }

    const prices = items
      .map((i) => i.price)
      .filter((p): p is number => p !== null && p > 0)
      .sort((a, b) => a - b);
    const medianPrice =
      prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;

    // ── Feature engineering (5 dimensions) ───────────────────────────────
    //
    // [0] wear       = log1p(wear_count)
    // [1] cpw        = log1p(price / (wear_count + 1))   cost-per-wear
    // [2] unused     = log1p(unused_score)
    // [3] age        = log1p(days_since_purchase)
    // [4] color      = color family index (0..10) for color-aware clustering

    const COLOR_FAMILY_INDEX: Record<string, number> = {
      blue: 0, red: 1, green: 2, brown: 3, pink: 4,
      purple: 5, orange: 6, yellow: 7, black: 8, white: 9, grey: 10,
    };

    const featureVectors = items.map((item) => {
      const wear =
        item.wear_count != null && isFinite(item.wear_count)
          ? item.wear_count
          : 0;
      const price =
        item.price != null && isFinite(item.price) ? item.price : medianPrice;
      const unused =
        item.unused_score != null && isFinite(item.unused_score)
          ? item.unused_score
          : 0;
      const age = daysSince(item.purchase_date ?? item.created_at);
      const colorFamily = normalizeColor(item.color || "");
      const colorIdx = COLOR_FAMILY_INDEX[colorFamily] ?? 5; // default to purple (mid-range)

      return [
        Math.log1p(wear),
        Math.log1p(price / (wear + 1)),
        Math.log1p(unused),
        Math.log1p(age),
        colorIdx / 10, // normalize to [0, 1] range
      ].map((v) => (isFinite(v) ? v : 0));
    });

    const nanCount = featureVectors.filter((v) =>
      v.some((x) => !isFinite(x)),
    ).length;
    console.log(
      'Clusters: featureVectors sample',
      featureVectors.slice(0, 3),
      'NaN/Inf count',
      nanCount,
    );

    // ── Normalise: min-max per dimension ──────────────────────────────────
    const dims = featureVectors[0].length;
    const normalized: number[][] = Array.from({ length: items.length }, () =>
      new Array(dims).fill(0),
    );

    for (let j = 0; j < dims; j++) {
      const col = featureVectors.map((row) => row[j]);
      const scaled = minmax(col);
      const names = ['wear', 'cost_per_wear', 'unused', 'age'];
      // Safety: replace any remaining NaN/Inf with 0.5 (neutral) so one bad
      // value can never collapse the entire dimension or corrupt k-means input.
      for (let i = 0; i < items.length; i++) {
        normalized[i][j] = isFinite(scaled[i]) ? scaled[i] : 0.5;
      }
      const col2 = normalized.map((r) => r[j]);
      const mean = col2.reduce((s, v) => s + v, 0) / col2.length;
      const variance =
        col2.reduce((s, v) => s + (v - mean) ** 2, 0) / col2.length;
      console.log(
        `Clusters: dim[${j}] ${names[j]} variance=${variance.toFixed(4)}`,
      );
    }

    console.log('Clusters: normalized sample', normalized.slice(0, 3));

    // ── Choose k ──────────────────────────────────────────────────────────
    let k: number;
    if (items.length < 8) k = 2;
    else if (items.length < 20) k = 3;
    else k = 4;
    console.log('Clusters: items', items.length, 'k', k);

    const result = kMeans(normalized, k);
    console.log(
      'Clusters: sizes',
      result.sizes,
      'inertia',
      isFinite(result.inertia) ? result.inertia.toFixed(3) : result.inertia,
    );
    console.log('Clusters: centroids', result.centroids);

    // ── Build response ─────────────────────────────────────────────────────
    const clusterMap = new Map<number, ClusterItem[]>();
    for (let i = 0; i < result.assignments.length; i++) {
      const cid = result.assignments[i];
      if (!clusterMap.has(cid)) clusterMap.set(cid, []);
      clusterMap.get(cid)!.push({
        id: items[i].id,
        name: items[i].name,
        type: items[i].type,
        image_url: items[i].image_url,
        wear_count: items[i].wear_count ?? 0,
        price: items[i].price ?? 0,
      });
    }

    const clusterIds = Array.from(clusterMap.keys()).sort(
      (a, b) =>
        (clusterMap.get(b)?.length ?? 0) - (clusterMap.get(a)?.length ?? 0),
    );

    const centroidLabels = assignLabels(result.centroids);
    const overallAvgWear =
      items.reduce((s, i) => s + (i.wear_count ?? 0), 0) / items.length;

    const clusters: ClusterGroup[] = clusterIds.map((cid) => {
      const clusterItems = clusterMap.get(cid)!;
      const { label, color } = centroidLabels[cid];
      const totalValue = clusterItems.reduce((s, i) => s + i.price, 0);
      const avgWear =
        clusterItems.reduce((s, i) => s + i.wear_count, 0) /
        clusterItems.length;

      const typeCount: Record<string, number> = {};
      for (const item of clusterItems) {
        typeCount[item.type] = (typeCount[item.type] ?? 0) + 1;
      }
      const typeBreakdown = Object.entries(typeCount)
        .map(([type, count]) => ({
          type,
          count,
          percentage: Math.round((count / clusterItems.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      const wearVsAverage =
        overallAvgWear > 0 ? Math.round((avgWear / overallAvgWear) * 100) : 100;

      return {
        id: cid,
        label,
        color,
        size: clusterItems.length,
        insight: {
          totalValue,
          avgWear: Math.round(avgWear * 10) / 10,
          avgPrice:
            clusterItems.length > 0
              ? Math.round(totalValue / clusterItems.length)
              : 0,
          wearVsAverage,
          typeBreakdown,
        },
        items: clusterItems,
      };
    });

    // Build a "Duplicates" cluster from items with same type + normalized color
    const typeColorGroups = new Map<string, RawItem[]>();
    for (const item of items) {
      const key = `${item.type}::${normalizeColor(item.color || '')}`;
      const group = typeColorGroups.get(key) || [];
      group.push(item);
      typeColorGroups.set(key, group);
    }

    const duplicateItems: ClusterItem[] = [];
    for (const group of typeColorGroups.values()) {
      if (group.length >= 2) {
        for (const item of group) {
          duplicateItems.push({
            id: item.id,
            name: item.name,
            type: item.type,
            image_url: item.image_url,
            wear_count: item.wear_count ?? 0,
            price: item.price ?? 0,
          });
        }
      }
    }

    const allClusters = [...clusters];
    if (duplicateItems.length > 0) {
      const totalValue = duplicateItems.reduce((s, i) => s + i.price, 0);
      const avgWear = duplicateItems.reduce((s, i) => s + i.wear_count, 0) / duplicateItems.length;
      const wearVsAverage = overallAvgWear > 0 ? Math.round((avgWear / overallAvgWear) * 100) : 100;

      const typeCount: Record<string, number> = {};
      for (const item of duplicateItems) {
        typeCount[item.type] = (typeCount[item.type] ?? 0) + 1;
      }
      const typeBreakdown = Object.entries(typeCount)
        .map(([type, count]) => ({ type, count, percentage: Math.round((count / duplicateItems.length) * 100) }))
        .sort((a, b) => b.count - a.count);

      allClusters.push({
        id: clusters.length,
        label: 'Potential Duplicates',
        color: '#f59e0b',
        size: duplicateItems.length,
        insight: {
          totalValue,
          avgWear: Math.round(avgWear * 10) / 10,
          avgPrice: Math.round(totalValue / duplicateItems.length),
          wearVsAverage,
          typeBreakdown,
        },
        items: duplicateItems,
      });
    }

    return NextResponse.json({ clusters: allClusters } satisfies ClusterResponse);
  } catch (err) {
    console.error('Clusters error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
