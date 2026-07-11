import { NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured' },
        { status: 500 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const mimeType = file.type;

    const { response } = await callGeminiWithFallback(apiKey, {
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
    color = color
      .replace(/["''`]/g, '')
      .replace(/\.$/, '')
      .split('\n')[0]
      .trim();

    return NextResponse.json({ color });
  } catch (error) {
    return NextResponse.json({ color: '' });
  }
}
