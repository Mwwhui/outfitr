import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { runScanPipeline, type ScanResult, type WearItem } from '@/lib/scanPipeline';
import crypto from 'crypto';

export const maxDuration = 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: CORS_HEADERS,
  });
}

const SCAN_CACHE = new Map<string, { data: ScanResult; ts: number }>();
const SCAN_CACHE_TTL = 24 * 60 * 60 * 1000;

function verifyToken(token: string): string | null {
  try {
    const lastDot = token.lastIndexOf('.');
    if (lastDot === -1) return null;
    const payload = token.slice(0, lastDot);
    const sig = token.slice(lastDot + 1);

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 3) return null;

    const [user_id, expiresAt] = parts;
    if (new Date(expiresAt).getTime() < Date.now()) return null;

    return user_id;
  } catch {
    return null;
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return corsResponse({ error: 'Unauthorized' }, 401);
    }

    const user_id = verifyToken(token);
    if (!user_id) {
      return corsResponse({ error: 'Invalid or expired token' }, 401);
    }

    const body = await req.json();
    const { image_base64, mimeType, price } = body;

    if (!image_base64 || !mimeType) {
      return corsResponse(
        { error: 'image_base64 and mimeType are required' },
        400,
      );
    }

    const cacheKey = image_base64.slice(0, 32);
    const cached = SCAN_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < SCAN_CACHE_TTL) {
      return corsResponse(cached.data);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return corsResponse({ error: 'Gemini API key not configured' }, 500);
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

    return corsResponse(result);
  } catch (error) {
    console.error('/api/wardrobe/browser-scan crashed:', error);
    return corsResponse(
      { error: error instanceof Error ? error.message : 'Internal Error' },
      500,
    );
  }
}
