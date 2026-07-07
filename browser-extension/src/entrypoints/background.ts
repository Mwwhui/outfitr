import { defineBackground } from 'wxt/sandbox';
import { getCachedResult, setCachedResult, dedupScan } from '../lib/api';
import { getToken, setToken } from '../lib/auth';

type ExtensionMessage =
  | { type: 'SCAN_PRODUCT'; imageUrl: string; tabId?: number }
  | { type: 'AUTH_TOKEN'; token: string }
  | { type: 'CLOSE_CONNECT_TAB'; connectTabId?: number; originalTabId?: number }
  | { type: 'OPEN_SIDEPANEL'; tabId?: number };

const STEPS = [
  'Detecting garment type...',
  'Checking your wardrobe...',
  'Calculating outfit combos...',
  'Generating verdict...',
];

async function setScanState(state: 'scanning' | 'done' | 'error', meta?: Record<string, unknown>) {
  await chrome.storage.session.set({ scanningStatus: state, ...meta });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: '' });
}

function setBadge(text: string, color?: string) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'scan-outfitr',
      title: 'Scan with Outfitr',
      contexts: ['image'],
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'scan-outfitr' && info.srcUrl && tab?.id) {
      handleScan(info.srcUrl, tab.id);
    }
  });

  chrome.runtime.onMessage.addListener((msg: ExtensionMessage, sender, sendResponse) => {
    if (msg.type === 'SCAN_PRODUCT') {
      handleScan(msg.imageUrl, sender.tab?.id || msg.tabId)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ error: err.message }));
      return true;
    }
    if (msg.type === 'AUTH_TOKEN') {
      setToken(msg.token).then(() => sendResponse({ success: true }));
      return true;
    }
    if (msg.type === 'CLOSE_CONNECT_TAB') {
      if (msg.connectTabId) chrome.tabs.remove(msg.connectTabId).catch(() => {});
      if (msg.originalTabId) chrome.tabs.update(msg.originalTabId, { active: true }).catch(() => {});
    }
    if (msg.type === 'OPEN_SIDEPANEL') {
      const tabId = msg.tabId || sender.tab?.id;
      if (tabId) {
        chrome.sidePanel.open({ tabId }).catch((e) => {
          console.error('[background] sidePanel.open failed:', e);
        });
      }
    }
  });

  async function handleScan(imageUrl: string, tabId: number | undefined) {
    const token = await getToken();
    if (!token) {
      try {
        if (typeof chrome.action.openPopup === 'function') {
          chrome.action.openPopup();
        }
      } catch { /* older Chrome: click icon */ }
      return { error: 'AUTH_REQUIRED' };
    }

    // Show scanning feedback immediately
    setBadge('...', '#000000');
    await chrome.storage.session.set({ lastResult: null, lastError: null, progressStep: 0, startedAt: Date.now() });
    await setScanState('scanning');

    // Open side panel immediately so user sees "Scanning..."
    if (tabId) {
      try { await chrome.sidePanel.open({ tabId }); }
      catch (e) { console.error('[background] sidePanel.open failed:', e); }
    }

    let stepTimer: ReturnType<typeof setInterval> | null = null;

    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
      if (!imgRes.ok) {
        await setScanState('error', { lastError: 'Failed to fetch image' });
        clearBadge();
        return { error: 'Failed to fetch image' };
      }

      // Step 1: image fetched, converting and analyzing
      await chrome.storage.session.set({ progressStep: 1 });

      const blob = await imgRes.blob();
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunk));
      }
      const base64 = btoa(binary);
      const mimeType = blob.type || 'image/jpeg';

      const cacheKey = base64.slice(0, 32);
      const cached = await getCachedResult(cacheKey);
      if (cached) {
        clearBadge();
        await chrome.storage.session.remove(['progressStep', 'startedAt']);
        await setScanState('done', { lastResult: cached, lastImageUrl: imageUrl });
        return cached;
      }

      // Step 2: scanning wardrobe — start time-based step advancement
      await chrome.storage.session.set({ progressStep: 2 });
      stepTimer = setInterval(async () => {
        const { progressStep } = await chrome.storage.session.get('progressStep');
        if (typeof progressStep === 'number' && progressStep < 3) {
          await chrome.storage.session.set({ progressStep: progressStep + 1 });
        }
      }, 6000);

      const result = await dedupScan(cacheKey, { image_base64: base64, mimeType });

      if (stepTimer) clearInterval(stepTimer);
      await setCachedResult(cacheKey, result);
      clearBadge();
      await chrome.storage.session.remove(['progressStep', 'startedAt']);
      await setScanState('done', { lastResult: result, lastImageUrl: imageUrl });
      return result;
    } catch (err) {
      if (stepTimer) clearInterval(stepTimer);
      const msg = err instanceof Error ? err.message : 'Scan failed';
      console.error('[background] scan failed:', msg);
      clearBadge();
      await chrome.storage.session.remove(['progressStep', 'startedAt']);
      await setScanState('error', { lastError: msg });
      return { error: msg };
    }
  }

  chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id! });
  });
});
