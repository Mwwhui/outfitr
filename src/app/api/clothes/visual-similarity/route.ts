import { NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/gemini';

export const maxDuration = 30;

interface VisualSimilarityResponse {
  is_different: boolean;
  reasoning: string;
  confidence: number;
}

// In-memory cache with 7-day TTL (keyed by new_image hash + existing IDs)
const VIS_CACHE = new Map<
  string,
  { data: VisualSimilarityResponse; ts: number }
>();
const VIS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// POST /api/clothes/visual-similarity
// Body: { new_image: base64, existing_images: [{ id, image_url, name }], type: string }
export async function POST(req: Request) {
  try {
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

    // Limit to 3 comparisons to control token cost
    const toCompare = existing_images.slice(0, 3);

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

    // Fetch existing images in parallel
    const imageResults = await Promise.all(
      toCompare.map(
        async (item: { image_url: string | URL | Request; name: any }) => {
          try {
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
        },
      ),
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

    // Guard: if no existing images were fetched, skip Gemini call
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Error' },
      { status: 500 },
    );
  }
}
