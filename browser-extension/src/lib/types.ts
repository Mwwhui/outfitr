export interface ScanResult {
  score: number;
  verdict: 'worth_it' | 'consider' | 'skip';
  one_liner: string;
  reasoning: string;
  breakdown: {
    gap_fill: number;
    color_fit: number;
    similarity_risk: number;
    outfit_potential: number;
    versatility: number;
  };
  outfit_multiplier: number;
  cost_per_wear: {
    estimated_price: number;
    projected_wears: number;
    projected_cpw: number;
    wardrobe_average_cpw: number;
    verdict: 'below_average' | 'similar' | 'above_average';
  } | null;
  similar_items: {
    name: string;
    image_url: string | null;
    id: string;
  }[];
  suggested_pairings: {
    name: string;
    type: string;
    image_url: string | null;
    color: string | null;
  }[];
  ghost_items: {
    name: string;
    image_url: string | null;
    id: string;
    wear_count: number;
  }[];
  budget_context: {
    item_price: number;
    wardrobe_average: number;
    wardrobe_median: number;
    wardrobe_max: number;
    flag: string;
  } | null;
  rate_limited?: boolean;
}
