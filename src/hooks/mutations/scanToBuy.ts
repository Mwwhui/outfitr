'use client';

import { useMutation } from '@tanstack/react-query';

export interface ScanInput {
  imageBase64: string;
  mimeType: string;
  price?: number;
}

export interface ScanBreakdown {
  gap_fill: number;
  color_fit: number;
  similarity_risk: number;
  outfit_potential: number;
  versatility: number;
}

export interface CostPerWear {
  estimated_price: number;
  projected_wears: number;
  projected_cpw: number;
  wardrobe_average_cpw: number;
  verdict: 'below_average' | 'similar' | 'above_average';
}

export interface SimilarItem {
  name: string;
  image_url: string | null;
  id: string;
}

export interface SuggestedPairing {
  name: string;
  type: string;
  image_url: string | null;
  color: string | null;
}

export interface ScanResult {
  score: number;
  verdict: 'worth_it' | 'consider' | 'skip';
  one_liner: string;
  reasoning: string;
  breakdown: ScanBreakdown;
  outfit_multiplier: number;
  cost_per_wear: CostPerWear | null;
  similar_items: SimilarItem[];
  suggested_pairings: SuggestedPairing[];
}

const SCAN_TIMEOUT = 75_000;

export function useScanToBuy() {
  return useMutation({
    mutationFn: async (input: ScanInput): Promise<ScanResult> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT);
      try {
        const res = await fetch('/api/wardrobe/scan-to-buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: input.imageBase64,
            mimeType: input.mimeType,
            price: input.price,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Scan failed');
        }
        return res.json();
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
