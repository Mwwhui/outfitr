const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] as const;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const FETCH_TIMEOUT = 15_000;

export interface GeminiResult {
  response: Response | null;
  rateLimited: boolean;
}

export async function callGeminiWithFallback(
  apiKey: string,
  body: object,
  maxRetriesPerModel = 2,
): Promise<GeminiResult> {
  let rateLimited = false;
  for (const model of MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) return { response: res, rateLimited };
        if (res.status === 429) {
          rateLimited = true;
          await delay(Math.min(2000 * 2 ** attempt, 10000));
          continue;
        }
        if (res.status === 503) {
          await delay(Math.min(2000 * 2 ** attempt, 10000));
          continue;
        }
        break;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // timeout — retry next attempt
        }
        if (attempt < maxRetriesPerModel) {
          await delay(2000 * 2 ** attempt);
        }
      }
    }
  }
  return { response: null, rateLimited };
}

export function extractText(response: Response): Promise<string> {
  return response.json().then((data) => data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '');
}

export function parseJsonResponse(text: string): string {
  return text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
}
