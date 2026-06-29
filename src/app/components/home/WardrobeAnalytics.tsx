'use client';

import DominantPalette from './DominantPalette';
import CategoryBalance from './CategoryBalance';
import HighestRotation from './HighestRotation';

interface ColorItem {
  color: string;
  hex: string | null;
  count: number;
  pct: number;
}

interface CategoryItem {
  type: string;
  count: number;
  ideal: number;
  pct: number;
}

interface WearItem {
  item_id: string;
  name: string;
  image_url: string | null;
  type: string;
  times_worn_this_month: number;
  total_wears: number;
}

interface Props {
  colors: ColorItem[];
  categories: CategoryItem[];
  topWorn: WearItem[];
  title?: string;
}

export default function WardrobeAnalytics({ colors, categories, topWorn, title = 'Wardrobe Analytics' }: Props) {
  return (
    <section className="space-y-6">
      <h3 className="text-3xl font-semibold text-on-surface border-b border-surface-variant pb-1">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DominantPalette colors={colors} />
        <CategoryBalance categories={categories} />
        <HighestRotation items={topWorn} />
      </div>
    </section>
  );
}
