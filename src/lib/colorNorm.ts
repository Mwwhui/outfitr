const COLOR_MAP: Record<string, string> = {
  // Blacks
  black: "black", "jet black": "black", charcoal: "black", "dark grey": "black",
  // Whites
  white: "white", "off white": "white", cream: "white", ivory: "white",
  "eggshell": "white", "pearl": "white",
  // Greys
  grey: "grey", gray: "grey", silver: "grey", "light grey": "grey",
  "medium grey": "grey", "heather grey": "grey",
  // Navies
  navy: "navy", "navy blue": "navy", "dark blue": "navy", "midnight blue": "navy",
  // Blues
  blue: "blue", "light blue": "blue", "sky blue": "blue", "royal blue": "blue",
  "baby blue": "blue", "powder blue": "blue", "cobalt": "blue",
  denim: "blue", "cornflower blue": "blue",
  // Reds
  red: "red", burgundy: "red", maroon: "red", crimson: "red",
  wine: "red", "dark red": "red", cherry: "red", scarlet: "red",
  // Greens
  green: "green", "olive green": "green", "forest green": "green",
  sage: "green", "dark green": "green", "emerald green": "green",
  "hunter green": "green", "army green": "green", mint: "green",
  "lime green": "green", "sea green": "green",
  // Browns
  brown: "brown", tan: "brown", beige: "brown", khaki: "brown",
  camel: "brown", "dark brown": "brown", "light brown": "brown",
  taupe: "brown", mocha: "brown", chocolate: "brown", cognac: "brown",
  // Pinks
  pink: "pink", "hot pink": "pink", blush: "pink", rose: "pink",
  "dusty rose": "pink", salmon: "pink", coral: "pink", "baby pink": "pink",
  // Purples
  purple: "purple", lavender: "purple", violet: "purple", plum: "purple",
  "dark purple": "purple", mauve: "purple", lilac: "purple",
  // Oranges
  orange: "orange", "burnt orange": "orange", terracotta: "orange",
  peach: "orange", tangerine: "orange", rust: "orange",
  // Yellows
  yellow: "yellow", mustard: "yellow", "pale yellow": "yellow",
  "golden yellow": "yellow", "lemon yellow": "yellow", amber: "yellow",
};

/**
 * Normalize a color name to a canonical form for fuzzy matching.
 * "Navy Blue" → "navy", "Dark Blue" → "navy", "Black" → "black"
 */
export function normalizeColor(color: string): string {
  const lower = color.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  // Try partial match: "navy blue top" → check if any key is contained
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return lower;
}

/**
 * Compute similarity between two color strings (0 to 1).
 * 1.0 = same normalized color
 * 0.8 = one contains the other (e.g., "blue" in "navy blue")
 * 0 = no match
 */
export function colorSimilarity(a: string, b: string): number {
  const na = normalizeColor(a);
  const nb = normalizeColor(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  return 0;
}
