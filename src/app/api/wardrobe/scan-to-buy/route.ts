import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';
import { runScanPipeline, type ScanResult, type WearItem } from '@/lib/scanPipeline';

export const maxDuration = 60;

const SCAN_CACHE = new Map<string, { data: ScanResult; ts: number }>();
const SCAN_CACHE_TTL = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { image_base64, mimeType, price } = body;

    if (!image_base64 || !mimeType) {
      return NextResponse.json(
        { error: 'image_base64 and mimeType are required' },
        { status: 400 },
      );
    }

    const cacheKey = image_base64.slice(0, 32);
    const cached = SCAN_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < SCAN_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const supabase = supabaseServer();
    const { data: clothesData } = await supabase
      .from('clothes')
      .select('id, name, type, color, image_url, wear_count, season, price, material, use_case')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .or('status.is.null,status.eq.available');

    const clothes: WearItem[] = (clothesData || []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color,
      image_url: c.image_url,
      wear_count: c.wear_count || 0,
      season: c.season,
      price: c.price,
      material: c.material,
      use_case: c.use_case,
    }));

    const result = await runScanPipeline({ apiKey, image_base64, mimeType, clothes, price });

    SCAN_CACHE.set(cacheKey, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('/api/wardrobe/scan-to-buy crashed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Error' },
      { status: 500 },
    );
  }
}
