import { NextResponse } from "next/server";

export const maxDuration = 30;

interface VisualSimilarityResponse {
  is_different: boolean;
  reasoning: string;
  confidence: number;
}

// POST /api/clothes/visual-similarity
// Body: { new_image: base64, existing_images: [{ id, image_url, name }], type: string }
export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const { new_image, existing_images, type } = body;

    if (!new_image || !existing_images?.length) {
      return NextResponse.json(
        { error: "new_image and existing_images are required" },
        { status: 400 },
      );
    }

    // Limit to 3 comparisons to control token cost
    const toCompare = existing_images.slice(0, 3);

    // Build the prompt with all images
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

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
        mimeType: "image/jpeg",
        data: new_image,
      },
    });

    parts.push({ text: "--- EXISTING ITEMS ---" });

    // Add existing images
    for (const item of toCompare) {
      // Fetch and convert to base64
      try {
        const res = await fetch(item.image_url);
        if (!res.ok) continue;
        const buffer = Buffer.from(await res.arrayBuffer());
        const base64 = buffer.toString("base64");

        parts.push({ text: `Existing: ${item.name}` });
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64,
          },
        });
      } catch {
        // Skip items we can't fetch
        continue;
      }
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini visual-similarity error:", errText);
      return NextResponse.json(
        { error: "Gemini API error" },
        { status: response.status },
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Parse JSON response (handle markdown-wrapped JSON)
    let result: VisualSimilarityResponse;
    try {
      const jsonStr = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
      result = JSON.parse(jsonStr);
    } catch {
      // Fallback: if Gemini returns freeform text, treat as "different" with low confidence
      result = {
        is_different: true,
        reasoning: text || "Could not parse AI response",
        confidence: 0.3,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("API /api/clothes/visual-similarity crashed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 },
    );
  }
}
