import { getToken, setToken, clearToken } from '../../lib/auth';

const $ = (id: string) => document.getElementById(id)!;

async function updateStatus() {
  const token = await getToken();
  const dot = $('status-dot');
  const text = $('status-text') as HTMLElement;
  const email = $('status-email') as HTMLElement;
  const disconnectBtn = $('disconnect-btn');

  if (token) {
    dot.className = 'status-dot online';
    text.textContent = 'Connected';

    // Decode user_id from token payload (first part before .)
    const lastDot = token.lastIndexOf('.');
    if (lastDot !== -1) {
      const payload = token.slice(0, lastDot);
      try {
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const parts = decoded.split('|');
        email.textContent = `User: ${parts[0]?.slice(0, 8)}...`;
      } catch {
        const parts = atob(payload).split('|');
        email.textContent = `User: ${parts[0]?.slice(0, 8)}...`;
      }
    }
    disconnectBtn.classList.remove('hidden');
  } else {
    dot.className = 'status-dot offline';
    text.textContent = 'Not connected';
    email.textContent = 'No token saved';
    disconnectBtn.classList.add('hidden');
  }
}

// Auto-Connect toggle
$('auto-connect-toggle').addEventListener('change', async (e) => {
  const checked = (e.target as HTMLInputElement).checked;
  await chrome.storage.local.set({ autoConnect: checked });
});

// Load saved toggle state
chrome.storage.local.get('autoConnect').then((data) => {
  ($('auto-connect-toggle') as HTMLInputElement).checked =
    data.autoConnect !== false;
});

// Disconnect
$('disconnect-btn').addEventListener('click', async () => {
  await clearToken();
  await chrome.storage.session.remove([
    'lastResult',
    'lastError',
    'scanningStatus',
  ]);
  updateStatus();
});

// Quick links
$('open-settings-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://outfitr.app/wardrobe/scan/settings' });
});

$('open-history-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://outfitr.app/wardrobe/scan/history' });
});

// Init
updateStatus();
