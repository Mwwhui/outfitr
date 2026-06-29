const COLOR_MAP: Record<string, string> = {
  // Blacks
  black: "black", "jet black": "black", charcoal: "black",
  "dark grey": "grey", "dark gray": "grey",
  // Whites
  white: "white", "off white": "white", cream: "white", ivory: "white",
  eggshell: "white", pearl: "white",
  // Greys
  grey: "grey", gray: "grey", silver: "grey", "light grey": "grey",
  "light gray": "grey", "medium grey": "grey", "heather grey": "grey",
  // Blues (including navy/indigo as subshades)
  navy: "blue", "navy blue": "blue", "midnight blue": "blue",
  indigo: "blue", "dark blue": "blue",
  blue: "blue", "light blue": "blue", "sky blue": "blue",
  "royal blue": "blue", "baby blue": "blue", "powder blue": "blue",
  cobalt: "blue", denim: "blue", "cornflower blue": "blue",
  // Reds
  red: "red", burgundy: "red", maroon: "red", crimson: "red",
  wine: "red", "dark red": "red", cherry: "red", scarlet: "red",
  // Greens
  green: "green", "olive green": "green", "forest green": "green",
  sage: "green", "dark green": "green", "emerald green": "green",
  "hunter green": "green", "army green": "green", mint: "green",
  "lime green": "green", "sea green": "green",
  teal: "green", turquoise: "green", aqua: "green",
  // Browns
  brown: "brown", tan: "brown", beige: "brown", khaki: "brown",
  camel: "brown", "dark brown": "brown", "light brown": "brown",
  taupe: "brown", mocha: "brown", chocolate: "brown", cognac: "brown",
  // Pinks
  pink: "pink", "hot pink": "pink", blush: "pink", rose: "pink",
  "dusty rose": "pink", salmon: "pink", coral: "pink", "baby pink": "pink",
  magenta: "pink", fuchsia: "pink",
  // Purples
  purple: "purple", lavender: "purple", violet: "purple", plum: "purple",
  "dark purple": "purple", mauve: "purple", lilac: "purple",
  // Oranges
  orange: "orange", "burnt orange": "orange", terracotta: "orange",
  peach: "orange", tangerine: "orange", rust: "orange",
  // Yellows
  yellow: "yellow", mustard: "yellow", "pale yellow": "yellow",
  "golden yellow": "yellow", "lemon yellow": "yellow",
  gold: "yellow", bronze: "yellow", copper: "yellow", amber: "yellow",
};

// Color families: each family groups visually similar shades
// Used for semantic similarity when exact normalized names differ
const COLOR_FAMILIES: Record<string, string[]> = {
  blue: ["blue"],
  red: ["red"],
  green: ["green"],
  brown: ["brown"],
  pink: ["pink"],
  purple: ["purple"],
  orange: ["orange"],
  yellow: ["yellow"],
  black: ["black"],
  white: ["white"],
  grey: ["grey"],
};

// Build reverse lookup: color → family name
const COLOR_TO_FAMILY: Record<string, string> = {};
for (const [family, members] of Object.entries(COLOR_FAMILIES)) {
  for (const member of members) {
    COLOR_TO_FAMILY[member] = family;
  }
}

/**
 * Normalize a color name to a canonical form for fuzzy matching.
 * Handles null, empty, patterns, and variant names.
 */
export function normalizeColor(color: string | null | undefined): string {
  if (!color) return "";
  const lower = color.toLowerCase().trim();
  if (!lower) return "";

  // Direct match
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
 * 0.6 = same color family (e.g., "navy" vs "sky blue" — both blue)
 * 0.3 = one contains the other substring (e.g., "dark" in "dark green")
 * 0 = no match
 */
export function colorSimilarity(a: string, b: string): number {
  if (!a && !b) return 0; // both empty = no meaningful match
  if (!a || !b) return 0;

  const na = normalizeColor(a);
  const nb = normalizeColor(b);

  if (!na || !nb) return 0;

  // Exact normalized match
  if (na === nb) return 1;

  // Same color family (e.g., "navy" and "sky blue" are both "blue")
  const fa = COLOR_TO_FAMILY[na];
  const fb = COLOR_TO_FAMILY[nb];
  if (fa && fb && fa === fb) return 0.6;

  // Substring containment (e.g., "dark" in "dark green")
  if (na.includes(nb) || nb.includes(na)) return 0.3;

  return 0;
}
