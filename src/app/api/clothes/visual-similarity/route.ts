import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase/server';
import { callGeminiWithFallback } from '@/lib/gemini';

export const maxDuration = 30;

interface VisualSimilarityResponse {
  is_different: boolean;
  reasoning: string;
  confidence: number;
}

// In-memory cache with 7-day TTL
const VIS_CACHE = new Map<
  string,
  { data: VisualSimilarityResponse; ts: number }
>();
const VIS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// only fetch images from Supabase Storage bucket
const ALLOWED_IMAGE_HOSTS = [
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || 'localhost',
];

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_IMAGE_HOSTS.some((host) => parsed.hostname === host);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;

    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 },
      );
    }

    const body = await req.json();
    const { new_image, existing_images, type } = body;

    if (!new_image || !existing_images?.length) {
      return NextResponse.json(
        { error: 'new_image and existing_images are required' },
        { status: 400 },
      );
    }

    // Verify ownership of existing items (fetch from DB with user_id check)
    const supabase = supabaseServer();
    const existingIds = existing_images.map((e: { id: string }) => e.id);
    const { data: ownedItems, error: ownershipError } = await supabase
      .from('clothes')
      .select('id, image_url, name')
      .in('id', existingIds)
      .eq('user_id', user_id)
      .is('deleted_at', null);

    if (ownershipError || !ownedItems) {
      console.error('Ownership check failed:', ownershipError);
      return NextResponse.json(
        { error: 'Failed to verify item ownership' },
        { status: 500 },
      );
    }

    // Only compare items that actually belong to the user
    const toCompare = existing_images
      .filter((e: { id: string }) => ownedItems.some((oi) => oi.id === e.id))
      .slice(0, 3);

    if (toCompare.length === 0) {
      return NextResponse.json({
        is_different: true,
        reasoning: 'No owned items found for comparison',
        confidence: 0.2,
      });
    }

    // Check cache (key = new_image first 32 chars + sorted existing IDs)
    const cacheKey =
      new_image.slice(0, 32) +
      '::' +
      toCompare
        .map((e: { id: string }) => e.id)
        .sort()
        .join(',');
    const cached = VIS_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < VIS_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Build the prompt with all images
    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [];

    parts.push({
      text: `You are a minimalist wardrobe advisor. Compare the FIRST image (new item being considered) against the ${toCompare.length} EXISTING items.

Your job: Is the new item FUNCTIONALLY DIFFERENT from the existing items?

"Functionally different" means: different style, cut, material appearance, formality level, or occasion use. For example:
- A casual cotton t-shirt vs a formal button-down = different
- A navy t-shirt vs a blue t-shirt = redundant (same function)
- A winter coat vs a light jacket = different

Respond with ONLY valid JSON (no markdown, no extra text):
{ "is_different": true/false, "reasoning": "brief explanation", "confidence": 0.0-1.0 }`,
    });

    // Add new image as first image
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: new_image,
      },
    });

    parts.push({ text: '--- EXISTING ITEMS ---' });

    // Fetch existing images in parallel (only from allowed hosts)
    const imageResults = await Promise.all(
      toCompare.map(async (item: { image_url: string; name: string }) => {
        try {
          // SSRF defense: only fetch from our own Supabase Storage
          if (!isAllowedImageUrl(item.image_url)) {
            console.warn('Blocked disallowed image URL:', item.image_url);
            return null;
          }

          const res = await fetch(item.image_url);
          if (!res.ok) return null;
          const buffer = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          return {
            name: item.name,
            mimeType: contentType.split(';')[0],
            base64: buffer.toString('base64'),
          };
        } catch {
          return null;
        }
      }),
    );

    // Add fetched images to prompt (skip nulls)
    for (const img of imageResults) {
      if (!img) continue;
      parts.push({ text: `Existing: ${img.name}` });
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      });
    }

    // If no existing images were fetched, skip Gemini call
    const hasExistingImages = imageResults.some(Boolean);
    if (!hasExistingImages) {
      return NextResponse.json({
        is_different: true,
        reasoning: 'Could not fetch existing items for comparison',
        confidence: 0.2,
      });
    }

    const { response } = await callGeminiWithFallback(apiKey, {
      contents: [{ parts }],
    });

    if (!response || !response.ok) {
      // On failure, return low-confidence fallback instead of error
      const fallback: VisualSimilarityResponse = {
        is_different: true,
        reasoning: 'Could not complete visual comparison',
        confidence: 0.2,
      };
      return NextResponse.json(fallback);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Parse JSON response (handle markdown-wrapped JSON)
    let result: VisualSimilarityResponse;
    try {
      const jsonStr = text
        .replace(/```json?\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      result = JSON.parse(jsonStr);
    } catch {
      // Fallback: if Gemini returns freeform text, treat as "different" with low confidence
      result = {
        is_different: true,
        reasoning: text || 'Could not parse AI response',
        confidence: 0.3,
      };
    }

    // Cache the result (7-day TTL)
    VIS_CACHE.set(cacheKey, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API /api/clothes/visual-similarity crashed:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
