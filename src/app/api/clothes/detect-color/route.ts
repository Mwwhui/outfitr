import { NextResponse } from 'next/server';

async function fetchGeminiWithRetry(
  url: string,
  body: object,
  maxRetries = 2,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      if (res.status === 429 || res.status === 503) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const mimeType = file.type;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    const response = await fetchGeminiWithRetry(geminiUrl, {
      contents: [
        {
          parts: [
            {
              text: "Analyze the clothing item in this image. Ignore any background, hangers, mannequin, human skin, or other items. What is its primary color? Compensate for poor, yellow, warm, or shadow-heavy indoor lighting (e.g., if a white shirt looks cream or yellow due to lighting, classify it as 'White'). Respond with ONLY the color name, capitalized and using descriptive but concise terms if appropriate (e.g., 'Olive Green', 'Navy Blue', 'Mustard Yellow', 'Cream', 'Burgundy'). Do not include any other words, preamble, or punctuation.",
            },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    if (!response || !response.ok) {
      // Graceful fallback: return empty color, client will use YOLO/HSV
      return NextResponse.json({ color: '' });
    }

    const data = await response.json();
    let color = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    // Clean up Gemini's messy output: strip quotes, periods, take first line only
    color = color.replace(/["''`]/g, '').replace(/\.$/, '').split('\n')[0].trim();

    return NextResponse.json({ color });
  } catch (error) {
    return NextResponse.json({ color: '' });
  }
}
