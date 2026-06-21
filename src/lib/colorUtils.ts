const COLOR_MAP: Record<string, { h: number; s: number; l: number }> = {
  Black: { h: 0, s: 0, l: 0 },
  White: { h: 0, s: 0, l: 100 },
  Grey: { h: 0, s: 0, l: 50 },
  Cream: { h: 45, s: 43, l: 86 },
  Beige: { h: 45, s: 29, l: 80 },
  Brown: { h: 30, s: 59, l: 33 },
  Navy: { h: 240, s: 100, l: 25 },
  Denim: { h: 214, s: 43, l: 47 },
  Pink: { h: 340, s: 60, l: 85 },
  Purple: { h: 280, s: 100, l: 50 },
  Red: { h: 0, s: 100, l: 50 },
  Orange: { h: 30, s: 100, l: 50 },
  Yellow: { h: 60, s: 100, l: 50 },
  Green: { h: 120, s: 100, l: 30 },
  Blue: { h: 240, s: 100, l: 50 },
};

function normalizeColor(name: string): string {
  const trimmed = name.trim();
  for (const key of Object.keys(COLOR_MAP)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return key;
  }
  return trimmed;
}

export function getHSL(color: string): { h: number; s: number; l: number } {
  if (!color || !color.trim()) return { h: 0, s: 0, l: 50 };
  const normalized = normalizeColor(color);
  return COLOR_MAP[normalized] ?? { h: 0, s: 0, l: 50 };
}

export function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2);
  return Math.min(d, 360 - d);
}

export function isNeutral(hsl: { h: number; s: number; l: number }): boolean {
  return hsl.s < 30;
}

interface HarmonyResult {
  score: number;
  label: string;
}

function lightnessLevel(l: number): string {
  if (l <= 30) return 'dark';
  if (l <= 65) return 'mid';
  return 'light';
}

export function pairHarmony(c1: string, c2: string): HarmonyResult {
  const a = getHSL(c1);
  const b = getHSL(c2);

  if (isNeutral(a) || isNeutral(b)) {
    const neutral = isNeutral(a) ? c1 : c2;
    return { score: 1.0, label: `${neutral} is neutral — goes with anything` };
  }

  const d = hueDistance(a.h, b.h);
  const deg = `${Math.round(d)}°`;

  // Saturation & lightness adjustments
  let bonus = 0;
  const parts: string[] = [];

  // Both low saturation → harmonious even with different hues
  if (a.s < 40 && b.s < 40) {
    bonus += 0.08;
    parts.push('both muted');
  }

  // One vivid, one muted → intentional accent pop
  const sa = a.s >= 60 ? 1 : 0;
  const sb = b.s >= 60 ? 1 : 0;
  if (sa !== sb) {
    bonus += 0.06;
    parts.push('accent pop');
  }

  // Same lightness level → cohesive
  if (lightnessLevel(a.l) === lightnessLevel(b.l)) {
    bonus += 0.04;
    parts.push('cohesive lightness');
  }

  // Very different lightness → high contrast
  if (Math.abs(a.l - b.l) > 50) {
    bonus += 0.05;
    parts.push('high contrast');
  }

  // Hue-based base score
  let baseScore: number;
  let baseLabel: string;

  if (d >= 150 && d <= 210) { baseScore = 0.95; baseLabel = 'Complementary'; }
  else if (d <= 30) { baseScore = 0.85; baseLabel = 'Analogous'; }
  else if (d >= 105 && d <= 135) { baseScore = 0.80; baseLabel = 'Triadic'; }
  else if (d <= 60) { baseScore = 0.70; baseLabel = 'Related'; }
  else { baseScore = 0.40; baseLabel = 'Mismatch'; }

  const score = Math.min(1.0, baseScore + bonus);
  const extra = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
  return { score, label: `${baseLabel} (${deg} apart)${extra}` };
}

export function colorHarmonyScore(c1: string, c2: string): number {
  return pairHarmony(c1, c2).score;
}

export function averageHarmony(colors: string[]): number {
  if (colors.length < 2) return 1.0;
  let total = 0;
  let count = 0;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      total += colorHarmonyScore(colors[i], colors[j]);
      count++;
    }
  }
  return count > 0 ? total / count : 1.0;
}

export function multiColorScore(colors: string[]): { score: number; detail: string } {
  const valid = colors.filter(c => c && c.trim());
  if (valid.length < 2) return { score: 1.0, detail: 'Single item — no comparison needed' };

  const hsls = valid.map(c => getHSL(c));
  const hues = hsls.map(h => h.h);
  const lights = hsls.map(h => h.l);

  // 1. Hue spread — largest gap between consecutive sorted hues
  const sorted = [...hues].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < sorted.length - 1; i++) maxGap = Math.max(maxGap, sorted[i + 1] - sorted[i]);
  maxGap = Math.max(maxGap, 360 - sorted[sorted.length - 1] + sorted[0]);
  const focusMetric = (360 - maxGap) / 360;

  let hueScore: number; let hueLabel: string;
  if (focusMetric > 0.85) { hueScore = 1.0; hueLabel = 'focused palette'; }
  else if (focusMetric > 0.60) { hueScore = 0.75; hueLabel = 'varied palette'; }
  else { hueScore = 0.40; hueLabel = 'scattered hues'; }

  // 2. Lightness contrast
  const lRange = Math.max(...lights) - Math.min(...lights);
  let conScore: number; let conLabel: string;
  if (lRange > 50) { conScore = 1.0; conLabel = 'good contrast'; }
  else if (lRange > 30) { conScore = 0.85; conLabel = 'moderate contrast'; }
  else if (lRange > 15) { conScore = 0.70; conLabel = 'low contrast'; }
  else { conScore = 0.55; conLabel = 'flat'; }

  // 3. Warm/cool balance
  const warm = hsls.filter(h => !isNeutral(h) && (h.h >= 350 || h.h <= 50 || (h.h >= 20 && h.h <= 90))).length;
  const cool = hsls.filter(h => !isNeutral(h) && h.h >= 150 && h.h <= 280).length;
  const neutrals = hsls.filter(h => isNeutral(h)).length;

  let tempScore: number; let tempLabel: string;
  if (neutrals === valid.length) { tempScore = 1.0; tempLabel = 'all neutrals'; }
  else if (warm > 0 && cool > 0) {
    const ratio = Math.min(warm, cool) / Math.max(warm, cool);
    tempScore = 0.70 + 0.30 * ratio;
    tempLabel = ratio > 0.5 ? 'balanced warm/cool' : 'mostly ' + (warm > cool ? 'warm' : 'cool');
  } else {
    tempScore = 0.70;
    tempLabel = `all ${warm > 0 ? 'warm' : 'cool'} tones`;
  }

  // 4. Statement overload penalty
  const statements = hsls.filter(h => !isNeutral(h) && h.s >= 60).length;
  let overload = 0; let overloadNote = '';
  if (statements >= 3) { overload = 0.15; overloadNote = '; too many bold colors'; }
  else if (statements >= 2) { overload = 0.05; overloadNote = '; 2 statement pieces'; }

  const raw = hueScore * 0.40 + conScore * 0.30 + tempScore * 0.30;
  const score = Math.max(0, Math.min(1, raw - overload));
  const detail = `${hueLabel}, ${conLabel}, ${tempLabel}${overloadNote}`;

  return { score, detail };
}

function isEarthColor(name: string): boolean {
  return ['Brown', 'Beige', 'Cream', 'Green', 'Denim', 'Olive', 'Khaki'].includes(normalizeColor(name));
}

function isCoolColor(name: string): boolean {
  return ['Blue', 'Navy', 'Purple', 'Grey', 'Teal', 'Indigo'].includes(normalizeColor(name));
}

function isWarmColor(name: string): boolean {
  return ['Red', 'Orange', 'Yellow', 'Pink', 'Coral', 'Peach'].includes(normalizeColor(name));
}

export function getPaletteName(colors: string[]): string {
  const validColors = colors.filter((c) => c && c.trim());
  if (validColors.length === 0) return 'Neutral Base';

  const hueValues = validColors.map((c) => getHSL(c).h);
  const minHue = Math.min(...hueValues);
  const maxHue = Math.max(...hueValues);
  const range = hueDistance(maxHue, minHue);

  const neutrals = validColors.filter((c) => isNeutral(getHSL(c)));
  const earths = validColors.filter(isEarthColor);
  const cools = validColors.filter(isCoolColor);
  const warms = validColors.filter(isWarmColor);
  const hasComplementary = validColors.some((c1, i) =>
    validColors.slice(i + 1).some((c2) => {
      const d = hueDistance(getHSL(c1).h, getHSL(c2).h);
      return d >= 150 && d <= 210;
    }),
  );

  if (neutrals.length >= validColors.length * 0.75) return 'Neutral Base';
  if (range <= 50) return 'Monochrome';
  if (hasComplementary) return 'Bold Contrast';
  if (earths.length >= Math.ceil(validColors.length / 2)) return 'Earth Tones';
  if (cools.length > warms.length) return 'Cool Tones';
  if (warms.length > cools.length) return 'Warm Tones';
  return 'Colorful Mix';
}
