export type DisposalMethod = 'sell' | 'donate' | 'recycle';

export interface ScoredItem {
  method: DisposalMethod;
  scores: Record<DisposalMethod, number>;
  reasons: string[];
}

export interface RecommenderInput {
  id: string;
  name: string;
  type?: string | null;
  color?: string | null;
  price?: number | null;
  brand?: string | null;
  material?: string | null;
  wear_count?: number | null;
  unused?: boolean | null;
  purchase_date?: string | null;
  created_at?: string | null;
}

const KNOWN_BRANDS = new Set([
  'nike', 'adidas', 'puma', 'zara', 'h&m', 'uniqlo', 'gucci', 'prada',
  'louis vuitton', 'chanel', 'hermès', 'burberry', 'ralph lauren', 'lacoste',
  'tommy hilfiger', 'calvin klein', 'levi\'s', 'levis', 'diesel', 'gap',
  'banana republic', 'j.crew', 'everlane', 'patagonia', 'the north face',
  'arcteryx', 'lululemon', 'all saints', 'cos', 'massimo dutti',
  'mango', 'bershka', 'pull&bear', 'stradivarius', 'weekday', 'monki',
  'urban outfitters', 'free people', 'anthropologie', 'reformation',
  'maje', 'sandro', 'claudie pierlot', 'the kooples', 'allsaints',
]);

const SELL_MATERIALS = new Set([
  'silk', 'leather', 'wool', 'denim', 'cashmere', 'linen', 'velvet',
]);

const DONATE_MATERIALS = new Set([
  'cotton', 'linen', 'wool', 'denim', 'fleece',
]);

const RECYCLE_MATERIALS = new Set([
  'synthetic', 'nylon', 'polyester', 'acrylic', 'spandex', 'lycra',
  'rayon', 'viscose', 'modal', 'acetate',
]);

function normalizeBrand(brand: string | null | undefined): string {
  return (brand || '').toLowerCase().trim();
}

function normalizeMaterial(material: string | null | undefined): string {
  return (material || '').toLowerCase().trim();
}

function getAgeYears(item: RecommenderInput): number | null {
  const ref = item.purchase_date || item.created_at;
  if (!ref) return null;
  const d = new Date(ref);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function recommendDisposal(item: RecommenderInput): ScoredItem {
  const price = item.price ?? 0;
  const wear = item.wear_count ?? 0;
  const unused = !!item.unused;
  const brand = normalizeBrand(item.brand);
  const material = normalizeMaterial(item.material);
  const age = getAgeYears(item) ?? 0;

  let sell = 50;
  let donate = 50;
  let recycle = 50;
  const reasons: string[] = [];

  if (price >= 80) {
    sell += 25;
    donate -= 5;
    recycle -= 15;
    reasons.push(`High value ($${price.toFixed(0)})`);
  } else if (price >= 40) {
    sell += 15;
    donate += 5;
    recycle -= 10;
  } else if (price >= 10) {
    donate += 10;
    sell -= 5;
    recycle -= 5;
  } else {
    recycle += 15;
    donate += 5;
    sell -= 20;
    if (price > 0) reasons.push('Low resale value');
  }

  if (wear === 0) {
    sell += 20;
    donate += 10;
    recycle -= 25;
    reasons.push('Never worn');
  } else if (wear <= 2) {
    sell += 15;
    donate += 5;
    recycle -= 15;
    reasons.push('Near-new condition');
  } else if (wear <= 10) {
    donate += 15;
    sell -= 5;
    recycle -= 5;
    reasons.push('Gently used');
  } else if (wear <= 20) {
    donate += 5;
    recycle += 10;
    sell -= 15;
    reasons.push('Moderately worn');
  } else {
    recycle += 25;
    donate -= 10;
    sell -= 25;
    reasons.push('Heavily worn');
  }

  if (unused) {
    sell += 15;
    donate += 10;
    recycle -= 20;
    if (!reasons.includes('Never worn')) reasons.push('Flagged as unused');
  }

  if (brand && KNOWN_BRANDS.has(brand)) {
    sell += 12;
    donate += 3;
    reasons.push(`Recognised brand (${item.brand})`);
  } else if (brand && brand.length > 0) {
    sell += 5;
  }

  if (material) {
    if (SELL_MATERIALS.has(material)) {
      sell += 10;
      donate += 5;
    }
    if (DONATE_MATERIALS.has(material)) {
      donate += 8;
    }
    if (RECYCLE_MATERIALS.has(material)) {
      recycle += 12;
      sell -= 5;
      if (wear > 10 || age > 3) {
        reasons.push(`${item.material} is widely recyclable`);
      }
    }
  }

  if (age < 1) {
    sell += 10;
    donate += 5;
  } else if (age < 2) {
    sell += 5;
  } else if (age < 5) {
    donate += 5;
    sell -= 5;
  } else {
    recycle += 10;
    donate -= 5;
    sell -= 10;
    if (age >= 5) reasons.push('Older garment');
  }

  sell = clamp(sell, 0, 100);
  donate = clamp(donate, 0, 100);
  recycle = clamp(recycle, 0, 100);

  const entries: [DisposalMethod, number][] = [
    ['sell', sell],
    ['donate', donate],
    ['recycle', recycle],
  ];
  entries.sort((a, b) => b[1] - a[1]);

  const winner = entries[0][0];

  const uniqueReasons = [...new Set(reasons)].slice(0, 3);

  return {
    method: winner,
    scores: { sell, donate, recycle },
    reasons: uniqueReasons,
  };
}

export function sortItemsByMethod<T extends RecommenderInput>(
  items: T[],
  method: DisposalMethod,
): Array<T & { _rec: ScoredItem }> {
  const scored = items.map((item) => ({
    ...(item as unknown as object),
    _rec: recommendDisposal(item),
  })) as Array<T & { _rec: ScoredItem }>;

  scored.sort((a, b) => {
    const aMethod = a._rec.method === method ? 1 : 0;
    const bMethod = b._rec.method === method ? 1 : 0;
    if (aMethod !== bMethod) return bMethod - aMethod;
    return b._rec.scores[method] - a._rec.scores[method];
  });

  return scored;
}

export function countRecommendations<T extends RecommenderInput>(
  items: T[],
): Record<DisposalMethod, number> {
  const counts: Record<DisposalMethod, number> = { sell: 0, donate: 0, recycle: 0 };
  for (const item of items) {
    const rec = recommendDisposal(item);
    counts[rec.method]++;
  }
  return counts;
}
