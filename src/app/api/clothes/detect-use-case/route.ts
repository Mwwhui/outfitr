import { NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/gemini';

const USE_CASE_OPTIONS = [
  'casual',
  'business',
  'sport',
  'sleep',
  'swim',
  'date',
];

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

    const response = await callGeminiWithFallback(apiKey, {
      contents: [
        {
          parts: [
            {
              text: `Analyze this clothing item image. Based on the garment's style, cut, fabric, and design, which of these use cases apply? Select all that apply:

- sleep: pajamas, nightgowns, loungewear intended for sleeping
- swim: swimsuits, bikinis, trunks, beach cover-ups
- sport: athletic wear, gym clothes, workout gear, activewear
- business: suits, blazers, dress shirts, formal trousers, professional attire
- date: elegant tops, evening dresses, going-out wear, date night outfits
- casual: everyday wear like t-shirts, jeans, casual dresses, relaxed items

Return ONLY a JSON array of matching use case strings from this list: ${JSON.stringify(USE_CASE_OPTIONS)}. Example: ["casual"] or ["business", "date"]. If none clearly apply, return ["casual"]. Do not include any other text.`,
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
      return NextResponse.json({ use_case: [] });
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';
    text = text
      .replace(/```json?\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    let use_case: string[];
    try {
      const parsed = JSON.parse(text);
      use_case = Array.isArray(parsed)
        ? parsed.filter((v: string) => USE_CASE_OPTIONS.includes(v))
        : [];
    } catch {
      use_case = [];
    }

    if (use_case.length === 0) {
      use_case = ['casual'];
    }

    return NextResponse.json({ use_case });
  } catch {
    return NextResponse.json({ use_case: [] });
  }
}
