import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://outfitr.app/extension/connect*', '*://localhost:3000/extension/connect*'],
  main() {
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      if (++attempts > maxAttempts) return;

      const el = document.getElementById('extension-connect-token');
      if (el?.dataset?.token) {
        const token = el.dataset.token;
        delete el.dataset.token;
        try {
          const response = await chrome.runtime.sendMessage({ type: 'AUTH_TOKEN', token });
          if (response?.success) return;
        } catch (e) {
          console.error('[content-auth] sendMessage failed:', e);
        }
      }

      setTimeout(poll, 400);
    };

    poll();
  },
});
