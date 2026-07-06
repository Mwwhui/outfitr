import { getToken, clearToken } from './auth';
import type { ScanResult } from './types';

const BASE_URL = (() => {
  if (typeof __API_BASE__ !== 'undefined') return __API_BASE__;
  return 'https://outfitr.app/api';
})();

interface ScanRequest {
  image_base64: string;
  mimeType: string;
  price?: number;
}

export async function scanProduct(input: ScanRequest): Promise<ScanResult> {
  const token = await getToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const res = await fetch(`${BASE_URL}/wardrobe/browser-scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(90000),
  });

  if (res.status === 401) {
    await clearToken();
    throw new Error('AUTH_REQUIRED');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Scan failed');
  }

  return res.json();
}

// In-memory dedup: keyed by image_hash, resolves to the same promise
const inflight = new Map<string, Promise<ScanResult>>();

export function dedupScan(key: string, input: ScanRequest): Promise<ScanResult> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = scanProduct(input).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// Session cache (survives popup close)
export async function getCachedResult(key: string): Promise<ScanResult | null> {
  const { cache } = await chrome.storage.session.get('cache');
  const entry = cache?.[key];
  if (entry && Date.now() - entry.ts < 86400000) return entry.data;
  return null;
}

export async function setCachedResult(key: string, data: ScanResult) {
  const { cache = {} } = await chrome.storage.session.get('cache');
  cache[key] = { data, ts: Date.now() };
  await chrome.storage.session.set({ cache });
}
