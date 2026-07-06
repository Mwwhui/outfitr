import type { ScanResult } from '../../lib/types';
import { getToken, setToken } from '../../lib/auth';

declare const __APP_BASE__: string;

const $ = (id: string) => document.getElementById(id)!;

let ringAnimFrame = 0;
function animateRing(el: SVGCircleElement, from: number, to: number, duration: number) {
  cancelAnimationFrame(ringAnimFrame);
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.style.strokeDashoffset = String(from + (to - from) * ease);
    if (t < 1) ringAnimFrame = requestAnimationFrame(step);
  };
  ringAnimFrame = requestAnimationFrame(step);
}

const STEPS = [
  'Detecting garment type...',
  'Checking your wardrobe...',
  'Calculating outfit combos...',
  'Generating verdict...',
];

function show(id: string) {
  document.querySelectorAll('.state').forEach((el) => el.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function showError(msg: string) {
  ($('error-msg') as HTMLElement).textContent = msg;
  show('state-error');
}

function renderResult(r: ScanResult) {
  const ring = $('score-circle') as SVGCircleElement;
  const circumference = 326.7;
  const offset = circumference - (r.score / 100) * circumference;

  // Show result state first so ring renders with CSS default (empty)
  show('state-result');

  // JS animation: start from empty (circumference) and animate to target offset
  animateRing(ring, circumference, offset, 800);

  ($('score-text') as HTMLSpanElement).textContent = String(r.score);
  const vt = $('verdict-text') as HTMLSpanElement;
  vt.textContent = r.verdict === 'worth_it' ? 'WORTH IT'
    : r.verdict === 'consider' ? 'CONSIDER' : 'SKIP';
  vt.style.color = r.verdict === 'worth_it' ? '#16a34a'
    : r.verdict === 'consider' ? '#ea580c' : '#dc2626';

  ($('one-liner') as HTMLElement).textContent = r.one_liner;

  // Rate limit notice
  if (r.rate_limited) {
    $('rate-limit-notice').classList.remove('hidden');
  } else {
    $('rate-limit-notice').classList.add('hidden');
  }

  if (r.ghost_items?.length > 0) {
    $('ghost-row').classList.remove('hidden');
    ($('ghost-text') as HTMLElement).textContent =
      `${r.ghost_items.length} similar item${r.ghost_items.length > 1 ? 's' : ''} you rarely wear`;
  } else {
    $('ghost-row').classList.add('hidden');
  }
}

// --- Manual token fallback ---
$('manual-btn').addEventListener('click', () => {
  $('manual-section').classList.toggle('hidden');
});

$('save-token-btn').addEventListener('click', async () => {
  const token = ($('token-input') as HTMLInputElement).value.trim();
  if (!token) return;
  await setToken(token);
  checkState();
});

$('get-token-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${__APP_BASE__}/wardrobe/scan/settings` });
});

// --- Auto-connect flow ---
$('connect-btn').addEventListener('click', async () => {
  show('state-connecting');
  ($('connecting-msg') as HTMLElement).textContent = 'Opening Outfitr...';
  $('scanning-elapsed').classList.add('hidden');
  $('step-dots').classList.add('hidden');
  $('stuck-warning-popup').classList.add('hidden');

  // Save the active tab so we can bounce back after connection
  const [originalTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const originalTabId = originalTab?.id;

  // Open the connect tab and track its ID
  const connectTab = await chrome.tabs.create({ url: `${__APP_BASE__}/extension/connect` });
  const connectTabId = connectTab.id;

  // Poll for token to be saved
  let attempts = 0;
  const maxAttempts = 90; // 45 seconds
  const poll = () => {
    getToken().then((token) => {
      if (token) {
        // Bounce back: close connect tab, focus the page the user was on
        chrome.runtime.sendMessage({ type: 'CLOSE_CONNECT_TAB', connectTabId, originalTabId });
        checkState();
      } else if (++attempts < maxAttempts) {
        setTimeout(poll, 500);
      } else {
        showError('Connection timed out. Please try again.');
      }
    });
  };
  setTimeout(poll, 1500);
});

// --- Result actions ---
$('retry-btn').addEventListener('click', () => checkState());

$('view-full-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL', tabId: tab.id });
  }
});

// Settings links
[$('settings-link'), $('settings-link2')].forEach(el => {
  el.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// --- State check ---
async function checkState() {
  const token = await getToken();
  if (!token) {
    show('state-auth');
    return;
  }

  const poll = () => {
    chrome.storage.session.get(['scanningStatus', 'lastResult', 'lastError', 'progressStep', 'startedAt'], (data) => {
      if (data.scanningStatus === 'scanning') {
        show('state-connecting');
        const step = data.progressStep ?? 0;
        const startedAt = data.startedAt ?? Date.now();
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);

        // Show scanning info
        ($('connecting-msg') as HTMLElement).textContent = STEPS[Math.min(step, STEPS.length - 1)];
        const elapsedEl = $('scanning-elapsed') as HTMLElement;
        elapsedEl.classList.remove('hidden');
        elapsedEl.textContent = `${elapsed}s`;

        // Update step dots
        const dots = document.querySelectorAll('.step-dots .dot');
        dots.forEach((dot, i) => {
          (dot as HTMLElement).className = 'dot' + (i < step ? ' done' : i === step ? ' active' : '');
        });
        $('step-dots').classList.remove('hidden');

        // Stuck warning
        if (elapsed > 30) {
          $('stuck-warning-popup').classList.remove('hidden');
        }

        // Timeout after 90s
        if (elapsed > 90) {
          showError('Scan timed out. Please try again.');
          return;
        }

        setTimeout(poll, 1000);
      } else if (data.lastResult) {
        renderResult(data.lastResult);
      } else if (data.lastError) {
        showError(data.lastError);
      } else {
        show('state-ready');
      }
    });
  };
  poll();
}

// Start
checkState();
