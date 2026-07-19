import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  vite: (env) => ({
    define: {
      __API_BASE__: JSON.stringify(
        env.mode === 'development'
          ? 'http://localhost:3000/api'
          : 'https://outfitr.app/api',
      ),
      __APP_BASE__: JSON.stringify(
        env.mode === 'development'
          ? 'http://localhost:3000'
          : 'https://outfitr.app',
      ),
    },
  }),
  manifest: {
    name: 'Outfitr Scan',
    version: '1.0.0',
    description: 'Scan any product image against your wardrobe',
    permissions: ['contextMenus', 'activeTab', 'storage', 'sidePanel', 'scripting'],
    host_permissions: [
      'http://localhost:3000/*',
      'https://outfitr.app/*',
    ],
    action: {
      default_title: 'Outfitr Scan',
      default_icon: '/icons/icon.png',
    },
    icons: {
      128: '/icons/icon.png',
    },
    content_scripts: [
      {
        matches: [
          'https://outfitr.app/extension/connect*',
          'http://localhost:3000/extension/connect*',
        ],
        js: ['content-auth.js'],
        run_at: 'document_idle',
      },
    ],
    web_accessible_resources: [
      {
        resources: ['icons/*'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
