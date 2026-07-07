import { multiColorScore, getPaletteName, pairHarmony } from './colorUtils';

export const USE_CASE_OPTIONS = ['casual', 'business', 'sport', 'sleep', 'swim', 'date'] as const;

export const INCOMPATIBLE_USE_CASES: Record<string, string[]> = {
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

export interface ClothingItem {
  id: string;
  name: string;
  type: string;
  color: string;
  season: string;
  image_url: string | null;
  favorite?: boolean;
  wear_count?: number;
  use_case?: string[];
}

export interface ScoreBreakdown {
  label: string;
  icon: string;
  weight: number;
  earned: number;
  detail: string;
}

export interface SuggestedOutfit {
  items: ClothingItem[];
  score: number;
  palette: string;
  breakdown: ScoreBreakdown[];
}

export interface WeatherData {
  temperature: number;
  weathercode: number;
  description?: string;
  humidity?: number;
  windSpeed?: number;
  feelsLike?: number;
}

export type OccasionKey = 'casual' | 'business' | 'formal' | 'sport' | 'date';

export function hasCompatibleUseCases(itemA: ClothingItem, itemB: ClothingItem): boolean {
  const tagsA = itemA.use_case || [];
  const tagsB = itemB.use_case || [];
  if (tagsA.length === 0 || tagsB.length === 0) return true;
  for (const tagA of tagsA) {
    const blocked = INCOMPATIBLE_USE_CASES[tagA];
    for (const tagB of tagsB) {
      if (!blocked || !blocked.includes(tagB)) {
        return true;
      }
    }
  }
  return false;
}

export function hasCompatibleSeasons(itemA: ClothingItem, itemB: ClothingItem): boolean {
  const seasonA = itemA.season || '';
  const seasonB = itemB.season || '';
  if (!seasonA || seasonA === 'All' || !seasonB || seasonB === 'All') return true;
  const blocked = INCOMPATIBLE_SEASONS[seasonA];
  if (blocked && blocked.includes(seasonB)) return false;
  return true;
}

function filterCompatibleUseCases<T extends { items: ClothingItem[] }>(expanded: T[]): T[] {
  return expanded.filter(({ items }) => {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (!hasCompatibleUseCases(items[i], items[j])) return false;
        if (!hasCompatibleSeasons(items[i], items[j])) return false;
      }
    }
    return true;
  });
}

type SlotKey = 'top' | 'bottom' | 'onepiece' | 'outerwear';

function inferSubType(name: string, type: string): string {
  const n = name.toLowerCase();
  if (/\btshirt\b|t[-\s]?shirt/i.test(n)) return 'tshirt';
  if (/hoodie|sweatshirt/i.test(n)) return 'hoodie';
  if (/sneaker|trainer|running shoe/i.test(n)) return 'sneakers';
  if (/flip[ -]?flop|slides\b/i.test(n)) return 'sandals';
  if (/sandal/i.test(n)) return 'sandals';
  if (/dress shirt|button[ -]?(?:down|up)|formal shirt|oxford shirt/i.test(n)) return 'dress_shirt';
  if (/blazer|suit jacket|sport coat/i.test(n)) return 'blazer';
  if (/\bdress\b|gown/i.test(n) && !/t[- ]?shirt/i.test(n)) return 'dress';
  if (/skirt/i.test(n)) return 'skirt';
  if (/shorts/i.test(n)) return 'shorts';
  if (/jeans?\b|denim/i.test(n)) return 'jeans';
  if (/chino|trouser|slack/i.test(n)) return 'chinos';
  if (/polo/i.test(n)) return 'polo';
  if (/sweater|jumper|cardigan|pullover/i.test(n)) return 'sweater';
  if (/jacket|coat/i.test(n)) return 'jacket';
  if (/legging|yoga pant/i.test(n)) return 'leggings';
  if (/tank ?top|vest|singlet/i.test(n)) return 'tank';
  if (/shirt|blouse|tee\b/i.test(n)) return 'shirt';
  if (/heel|pump|stiletto/i.test(n)) return 'heels';
  if (/loafer|oxford|derby|brogue/i.test(n)) return 'loafers';
  if (/\bboot/i.test(n)) return 'boots';
  if (type === 'Tops') return 'generic_top';
  if (type === 'Bottoms') return 'generic_bottom';
  if (type === 'Outerwear') return 'generic_outerwear';
  if (type === 'One-Piece') return 'generic_onepiece';
  return 'unknown';
}

const TEMP_BANDS: { max: number; label: string; seasons: string[] }[] = [
  { max: 0, label: 'very_cold', seasons: ['Winter'] },
  { max: 10, label: 'cold', seasons: ['Winter', 'Autumn'] },
  { max: 18, label: 'cool', seasons: ['Autumn', 'Spring'] },
  { max: 25, label: 'mild', seasons: ['Spring', 'Autumn'] },
  { max: 30, label: 'warm', seasons: ['Summer', 'Spring'] },
  { max: 99, label: 'hot', seasons: ['Summer'] },
];

const OCCASION_DEFS: Record<
  OccasionKey,
  { slots: SlotKey[]; preferred: string[]; avoid: string[] }
> = {
  casual: {
    slots: ['top', 'bottom'],
    preferred: ['tshirt', 'hoodie', 'jeans', 'shorts', 'sneakers', 'polo', 'sweater', 'tank', 'shirt', 'generic_top', 'generic_bottom'],
    avoid: ['blazer', 'dress_shirt', 'dress', 'loafers', 'coat', 'heels', 'chinos', 'boots', 'generic_outerwear'],
  },
  business: {
    slots: ['top', 'bottom', 'outerwear'],
    preferred: ['dress_shirt', 'blazer', 'chinos', 'loafers', 'shirt', 'sweater', 'generic_outerwear', 'dress'],
    avoid: ['tshirt', 'hoodie', 'shorts', 'sneakers', 'jeans', 'sandals', 'tank', 'leggings', 'tank'],
  },
  formal: {
    slots: ['top', 'bottom', 'outerwear'],
    preferred: ['dress_shirt', 'blazer', 'dress', 'chinos', 'loafers', 'coat', 'heels', 'generic_outerwear'],
    avoid: ['tshirt', 'hoodie', 'shorts', 'jeans', 'sneakers', 'polo', 'sweater', 'sandals', 'tank', 'leggings', 'boots', 'generic_top', 'generic_bottom'],
  },
  sport: {
    slots: ['top', 'bottom'],
    preferred: ['tshirt', 'shorts', 'sneakers', 'hoodie', 'leggings', 'tank', 'generic_bottom'],
    avoid: ['blazer', 'dress_shirt', 'dress', 'loafers', 'coat', 'chinos', 'heels', 'shirt', 'boots', 'generic_outerwear', 'generic_onepiece'],
  },
  date: {
    slots: ['top', 'bottom', 'outerwear'],
    preferred: ['dress_shirt', 'polo', 'dress', 'blazer', 'jeans', 'sweater', 'loafers', 'heels', 'shirt', 'jacket', 'generic_outerwear'],
    avoid: ['hoodie', 'shorts', 'sneakers', 'tshirt', 'sandals', 'tank', 'leggings', 'generic_bottom'],
  },
};

const OCCASION_PALETTES: Record<OccasionKey, string[]> = {
  casual: [],
  business: ['Navy', 'Grey', 'White', 'Black', 'Burgundy', 'Beige', 'Cream', 'Brown', 'Denim'],
  formal: ['Black', 'White', 'Navy', 'Red', 'Purple', 'Green', 'Blue', 'Burgundy'],
  sport: ['White', 'Black', 'Blue', 'Red', 'Green', 'Yellow', 'Orange'],
  date: ['Red', 'Pink', 'Burgundy', 'Black', 'White', 'Purple', 'Navy'],
};

const FORMALITY_LEVEL: Record<string, number> = {
  // 1 = casual, 4 = formal
  tshirt: 1, hoodie: 1, shorts: 1, tank: 1, sneakers: 1, sandals: 1, leggings: 1,
  shirt: 2, polo: 2, jeans: 2, generic_top: 2, generic_bottom: 2, sweater: 2, boots: 2,
  dress_shirt: 3, blazer: 3, chinos: 3, loafers: 3, jacket: 3, dress: 3, skirt: 3, generic_outerwear: 3,
  coat: 4, heels: 4, generic_onepiece: 3,
};

function formalityFit(items: ClothingItem[]): { score: number; detail: string } {
  if (items.length < 2) return { score: 0, detail: '' };
  const levels = items.map(i => FORMALITY_LEVEL[inferSubType(i.name, i.type)] || 2);
  const max = Math.max(...levels);
  const min = Math.min(...levels);
  const gap = max - min;
  if (gap <= 1) return { score: 0, detail: '' };
  const names = items.filter((_, i) => levels[i] === max || levels[i] === min)
    .map(i => `"${i.name}"`).join(', ');
  const penalty = Math.min(0.5, gap * 0.15);
  return {
    score: 1 - penalty,
    detail: `Formality mismatch (${gap} level${gap > 1 ? 's' : ''} apart) — ${names}`,
  };
}

function getSeasonsForTemp(temp: number): string[] {
  for (const band of TEMP_BANDS) {
    if (temp <= band.max) return band.seasons;
  }
  return ['All'];
}

function filterBySeason(clothes: ClothingItem[], seasons: string[]): ClothingItem[] {
  return clothes.filter((c) => {
    if (!c.season || c.season === 'All') return true;
    return seasons.includes(c.season);
  });
}

function partitionBySlot(clothes: ClothingItem[]): Record<SlotKey, ClothingItem[]> {
  const map: Record<SlotKey, ClothingItem[]> = {
    top: [],
    bottom: [],
    onepiece: [],
    outerwear: [],
  };
  for (const item of clothes) {
    if (item.type === 'Tops') map.top.push(item);
    else if (item.type === 'Bottoms') map.bottom.push(item);
    else if (item.type === 'One-Piece') map.onepiece.push(item);
    else if (item.type === 'Outerwear') map.outerwear.push(item);
  }
  return map;
}

function getColors(items: ClothingItem[]): string[] {
  return items.map((i) => i.color || '');
}

// ── Scoring helpers (each returns normalized score + human detail) ──

function weatherFit(items: ClothingItem[], seasons: string[]): { score: number; detail: string } {
  if (seasons.length === 0) return { score: 0.5, detail: 'Weather data unavailable — neutral score' };
  const matchCount = items.filter((i) => !i.season || i.season === 'All' || seasons.includes(i.season)).length;
  if (matchCount === items.length) {
    const seasonLabel = seasons.join('/');
    return { score: 1.0, detail: `All ${items.length} item${items.length > 1 ? 's' : ''} suitable for ${seasonLabel} weather` };
  }
  if (matchCount > 0) {
    const mismatched = items.filter((i) => i.season && i.season !== 'All' && !seasons.includes(i.season));
    const names = mismatched.map((i) => `"${i.name}" (${i.season})`).join(', ');
    return { score: 0.5, detail: `${matchCount} of ${items.length} suitable — ${names} not ideal for current weather` };
  }
  const names = items.map((i) => `"${i.name}"`).join(', ');
  return { score: 0.2, detail: `None of the items suit current weather — ${names}` };
}

function occasionFit(items: ClothingItem[], def: { slots: SlotKey[]; preferred: string[]; avoid: string[] }, occasionLabel: string): { score: number; detail: string } {
  if (items.length === 0) return { score: 0, detail: 'No items to evaluate' };

  const subtypes = items.map(i => inferSubType(i.name, i.type));
  const preferred = subtypes.filter(s => def.preferred.includes(s)).length;
  const avoided = subtypes.filter(s => def.avoid.includes(s)).length;

  const preferredRatio = items.length > 0 ? preferred / items.length : 0;
  const avoidRatio = items.length > 0 ? avoided / items.length : 0;
  let score = preferredRatio * (1 - avoidRatio * 0.7);
  score = Math.max(0, Math.min(1, score));

  const parts: string[] = [];
  if (preferred > 0) {
    const set = [...new Set(subtypes.filter(s => def.preferred.includes(s)))];
    parts.push(`${preferred}/${items.length} ideal for ${occasionLabel} (${set.join(', ')})`);
  }
  if (avoided > 0) {
    const set = [...new Set(subtypes.filter(s => def.avoid.includes(s)))];
    parts.push(`${avoided}/${items.length} not suited (${set.join(', ')})`);
  }
  if (preferred === 0 && avoided === 0) {
    parts.push(`Neutral fit for ${occasionLabel}`);
  }
  return { score, detail: parts.join('; ') };
}

function completeness(filled: number, required: number, onepieceMode: boolean): { score: number; detail: string } {
  const req = onepieceMode ? required - 1 : required;
  if (req === 0) return { score: 1.0, detail: 'No required slots for this occasion' };
  const filledSlots = onepieceMode ? filled + 1 : filled;
  const ratio = filledSlots / req;
  if (ratio >= 1) return { score: 1.0, detail: `All ${req} required slot${req > 1 ? 's' : ''} filled${onepieceMode ? ' (onepiece counts as top + bottom)' : ''}` };
  const missing = req - filledSlots;
  return { score: ratio, detail: `${filledSlots} of ${req} slots filled — missing ${missing} item${missing > 1 ? 's' : ''}` };
}

function favorites(items: ClothingItem[]): { score: number; detail: string } {
  if (items.length === 0) return { score: 0, detail: 'No items to evaluate' };
  const favCount = items.filter((i) => i.favorite).length;
  if (favCount === items.length) return { score: 1.0, detail: 'All items are favorites' };
  if (favCount > 0) return { score: favCount / items.length, detail: `${favCount} of ${items.length} item${items.length > 1 ? 's' : ''} are favorites` };
  return { score: 0, detail: 'No favorites in this outfit' };
}

function wear(items: ClothingItem[]): { score: number; detail: string } {
  if (items.length === 0) return { score: 0, detail: '' };
  const avgWear = items.reduce((s, i) => s + (i.wear_count ?? 0), 0) / items.length;

  let score: number;
  let detail: string;

  if (avgWear === 0) {
    score = 1.0;
    detail = 'All items are fresh — perfect rotation';
  } else if (avgWear <= 3) {
    score = 0.8;
    detail = `Avg ${Math.round(avgWear)} wears — good rotation`;
  } else if (avgWear <= 8) {
    score = 0.5;
    detail = `Avg ${Math.round(avgWear)} wears — moderate rotation`;
  } else if (avgWear <= 15) {
    score = 0.3;
    detail = `Avg ${Math.round(avgWear)} wears — some items overused`;
  } else {
    score = 0.15;
    detail = `Avg ${Math.round(avgWear)} wears — wear rotation needed`;
  }

  const overused = items.filter(i => (i.wear_count ?? 0) > 15);
  if (overused.length > 0) {
    score = Math.max(0.05, score - overused.length * 0.1);
    detail += `; ${overused.length} item(s) heavily worn`;
  }

  return { score, detail };
}

function colorDetail(colors: string[]): string {
  if (colors.length < 2) return 'Single item — no color comparison needed';
  const lines: string[] = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const c1 = colors[i] || 'Unknown';
      const c2 = colors[j] || 'Unknown';
      const { score, label } = pairHarmony(c1, c2);
      lines.push(`${c1} × ${c2} = ${Math.round(score * 100)}% — ${label}`);
    }
  }
  return lines.join('\n');
}

function occasionColorFit(colors: string[], palette: string[]): { score: number; detail: string } {
  if (!palette || palette.length === 0) return { score: 0, detail: '' };
  const validColors = colors.filter(c => c && c.trim());
  if (validColors.length === 0) return { score: 0, detail: '' };
  const matchCount = validColors.filter(c => palette.includes(c)).length;
  if (matchCount === validColors.length) return { score: 1.0, detail: `All items match the occasion color palette (${palette.join(', ')})` };
  if (matchCount > 0) return { score: 0.5, detail: `${matchCount}/${validColors.length} items match the occasion color palette` };
  return { score: 0, detail: 'No items match the occasion color palette' };
}

function getPairBoost(ids: string[], freq: Record<string, number>): { score: number; detail: string } {
  if (Object.keys(freq).length === 0) return { score: 0, detail: '' };
  let totalPairs = 0;
  let count = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const val = freq[key] || 0;
      totalPairs += val;
      if (val > 0) count++;
    }
  }
  if (totalPairs === 0) return { score: 0, detail: '' };
  const score = Math.min(totalPairs * 0.5, 5) / 10;
  const detail = count === 1
    ? `You've worn 1 item pairing ${totalPairs} time${totalPairs > 1 ? 's' : ''} before`
    : `You've worn ${count} item pairings ${totalPairs} time${totalPairs > 1 ? 's' : ''} before`;
  return { score, detail };
}

function jaccardSimilarity(idsA: string[], idsB: string[]): number {
  const setA = new Set(idsA);
  const setB = new Set(idsB);
  let intersection = 0;
  for (const id of setA) if (setB.has(id)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function selectDiverse(scored: SuggestedOutfit[], maxCount: number): SuggestedOutfit[] {
  if (scored.length === 0) return [];
  if (scored.length <= maxCount) return scored;

  const result: SuggestedOutfit[] = [scored[0]];
  const remaining = scored.slice(1);

  while (result.length < maxCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestAdjusted = -1;

    for (let i = 0; i < remaining.length; i++) {
      const ids = remaining[i].items.map(it => it.id);
      let maxSim = 0;
      for (const r of result) {
        const sim = jaccardSimilarity(ids, r.items.map(it => it.id));
        if (sim > maxSim) maxSim = sim;
      }
      // Hard skip: exclude combos that share more than half their items
      if (maxSim > 0.5) continue;
      const adjusted = remaining[i].score * (1 - 0.5 * maxSim);
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }
    if (bestAdjusted < 0) break; // no qualifying combo found
    result.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }
  return result;
}

interface ComboScore {
  total: number;
  breakdown: ScoreBreakdown[];
}

function sleepPenalty(items: ClothingItem[]): { score: number; detail: string } {
  const sleepCount = items.filter((i) => i.use_case?.includes('sleep')).length;
  if (sleepCount === 0) return { score: 1.0, detail: 'No sleepwear — daytime ready' };
  if (sleepCount === items.length) {
    return { score: 0.0, detail: `All ${items.length} items are sleepwear — prioritising daytime outfits` };
  }
  return { score: 0.3, detail: `${sleepCount} sleep item${sleepCount > 1 ? 's' : ''} — daytime use cases preferred` };
}

function scoreCombo(
  items: ClothingItem[],
  occasion: OccasionKey,
  seasons: string[],
  onepieceMode: boolean,
  pairFreq: Record<string, number>,
): ComboScore {
  if (items.length === 0) return { total: 0, breakdown: [] };

  const occasionDef = OCCASION_DEFS[occasion];
  const colors = getColors(items);

  const colorResult = multiColorScore(colors);
  const weatherResult = weatherFit(items, seasons);
  const occasionResult = occasionFit(items, occasionDef, occasion);
  const completeResult = completeness(items.length, occasionDef.slots.length, onepieceMode);
  const favResult = favorites(items);
  const wearResult = wear(items);
  const occPaletteResult = occasionColorFit(colors, OCCASION_PALETTES[occasion]);
  const formResult = formalityFit(items);
  const pairBoost = getPairBoost(items.map(i => i.id), pairFreq);
  const sleepResult = sleepPenalty(items);

  const weighted = [
    { label: 'Color Harmony', icon: '🎨', weight: 20, value: colorResult.score, detail: colorResult.detail + '\n' + colorDetail(colors) },
    { label: 'Weather Fit', icon: '🌤️', weight: 10, value: weatherResult.score, detail: weatherResult.detail },
    { label: 'Occasion Fit', icon: '👔', weight: 25, value: occasionResult.score, detail: occasionResult.detail },
    { label: 'Color Mood', icon: '🎨', weight: 5, value: occPaletteResult.score, detail: occPaletteResult.detail },
    { label: 'Completeness', icon: '✅', weight: 10, value: completeResult.score, detail: completeResult.detail },
    { label: 'Favorites', icon: '⭐', weight: 10, value: favResult.score, detail: favResult.detail },
  ];

  if (formResult.detail) {
    weighted.push({ label: 'Formality', icon: '👔', weight: 5, value: formResult.score, detail: formResult.detail });
  }
  if (wearResult.detail) {
    weighted.push({ label: 'Wear Balance', icon: '🔄', weight: 5, value: wearResult.score, detail: wearResult.detail });
  }
  if (pairBoost.detail) {
    weighted.push({ label: 'You Like This', icon: '❤️', weight: 5, value: pairBoost.score, detail: pairBoost.detail });
  }
  weighted.push({ label: 'Use Case', icon: '🌙', weight: 10, value: sleepResult.score, detail: sleepResult.detail });

  const breakdown: ScoreBreakdown[] = weighted.map((w) => ({
    label: w.label,
    icon: w.icon,
    weight: w.weight,
    earned: Math.round(w.value * w.weight),
    detail: w.detail,
  }));

  const total = breakdown.reduce((s, b) => s + b.earned, 0);

  return { total, breakdown };
}

function generateCombinations(
  slots: Record<SlotKey, ClothingItem[]>,
  requiredSlots: SlotKey[],
): ClothingItem[][] {
  const available = requiredSlots.filter((s) => slots[s].length > 0);
  if (available.length === 0) return [];

  const results: ClothingItem[][] = [];
  function recurse(idx: number, current: ClothingItem[]) {
    if (idx === available.length) {
      results.push([...current]);
      return;
    }
    const slot = available[idx];
    for (const item of slots[slot]) {
      current.push(item);
      recurse(idx + 1, current);
      current.pop();
    }
  }
  recurse(0, []);
  return results;
}

function expandWithOnepiece(
  combos: ClothingItem[][],
  requiredSlots: SlotKey[],
  onepieces: ClothingItem[],
): { items: ClothingItem[]; onepieceMode: boolean }[] {
  const needsTopBottom = requiredSlots.includes('top') && requiredSlots.includes('bottom');
  if (!needsTopBottom || onepieces.length === 0) {
    return combos.map((c) => ({ items: c, onepieceMode: false }));
  }

  const expanded: { items: ClothingItem[]; onepieceMode: boolean }[] = combos.map((combo) => ({
    items: combo,
    onepieceMode: false,
  }));
  for (const op of onepieces) {
    expanded.push({ items: [op], onepieceMode: true });
  }
  return expanded;
}

export function suggestOutfits(
  clothes: ClothingItem[],
  weather: WeatherData | null,
  occasion: OccasionKey,
  pairFreq: Record<string, number> = {},
  seedItemIds: string[] = [],
): SuggestedOutfit[] {
  if (clothes.length === 0) return [];

  const seasons = weather ? getSeasonsForTemp(weather.temperature) : [];
  const filtered = weather ? filterBySeason(clothes, seasons) : clothes;

  let workingSet = filtered;
  if (workingSet.length === 0) {
    workingSet = filterBySeason(clothes, getSeasonsForTemp(30));
  }
  if (workingSet.length === 0) return [];

  const seedSet = new Set(seedItemIds);
  const hasSeeds = seedSet.size > 0;

  // Split into seed items (user-chosen, always included) and pool for remaining slots
  const seedItems: ClothingItem[] = [];
  const poolItems: ClothingItem[] = [];
  if (hasSeeds) {
    for (const item of workingSet) {
      if (seedSet.has(item.id)) seedItems.push(item);
      else poolItems.push(item);
    }
    // Also check seeds outside the weather-filtered set (user chose them explicitly)
    for (const item of clothes) {
      if (seedSet.has(item.id) && !seedItems.some(s => s.id === item.id)) {
        seedItems.push(item);
      }
    }
    if (seedItems.length === 0) return [];
  }

  const pool = hasSeeds ? poolItems : workingSet;
  const partitioned = partitionBySlot(pool);
  const required = OCCASION_DEFS[occasion].slots;

  if (hasSeeds) {
    // Determine which required slots the seeds already fill
    const seedPartition = partitionBySlot(seedItems);
    const stillRequired = required.filter(s => seedPartition[s].length === 0);

    // If all required slots are filled by seeds, return single "outfit"
    if (stillRequired.length === 0) {
      const result = scoreCombo(seedItems, occasion, seasons, false, pairFreq);
      const s: SuggestedOutfit = {
        items: seedItems,
        score: result.total,
        palette: getPaletteName(getColors(seedItems)),
        breakdown: result.breakdown,
      };
      return selectDiverse([s], 1);
    }

    // Generate combos for still-required slots from pool
    const rawCombos = generateCombinations(partitioned, stillRequired);
    if (rawCombos.length === 0) return [seedSingleOutfit(seedItems, occasion, seasons, pairFreq)];

    // Append seed items to each combo
    const combosWithSeeds = rawCombos.map(combo => [...combo, ...seedItems]);

    // Handle onepiece expansion for remaining slots + seeds
    const expanded = filterCompatibleUseCases(expandWithOnepiece(combosWithSeeds, stillRequired, partitioned.onepiece));

    const scored = expanded.map(({ items, onepieceMode }) => {
      const result = scoreCombo(items, occasion, seasons, onepieceMode, pairFreq);
      return {
        items,
        score: result.total,
        palette: getPaletteName(getColors(items)),
        breakdown: result.breakdown,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const deduped: SuggestedOutfit[] = [];
    for (const s of scored) {
      const key = s.items.map(i => i.id).sort().join(',');
      if (!seen.has(key)) { seen.add(key); deduped.push(s); }
    }
    return selectDiverse(deduped, 5);
  }

  // No seeds — original flow
  const rawCombos = generateCombinations(partitioned, required);
  if (rawCombos.length === 0) return [];

  const expanded = filterCompatibleUseCases(expandWithOnepiece(rawCombos, required, partitioned.onepiece));

  const scored = expanded.map(({ items, onepieceMode }) => {
    const result = scoreCombo(items, occasion, seasons, onepieceMode, pairFreq);
    return {
      items,
      score: result.total,
      palette: getPaletteName(getColors(items)),
      breakdown: result.breakdown,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const deduped: SuggestedOutfit[] = [];
  for (const s of scored) {
    const key = s.items.map((i) => i.id).sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(s);
    }
  }

  return selectDiverse(deduped, 3);
}

function seedSingleOutfit(
  seedItems: ClothingItem[],
  occasion: OccasionKey,
  seasons: string[],
  pairFreq: Record<string, number>,
): SuggestedOutfit {
  const result = scoreCombo(seedItems, occasion, seasons, false, pairFreq);
  return {
    items: seedItems,
    score: result.total,
    palette: getPaletteName(getColors(seedItems)),
    breakdown: result.breakdown,
  };
}
