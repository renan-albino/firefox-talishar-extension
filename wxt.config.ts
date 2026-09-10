import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Talishar Log Exporter',
    description: 'Capture combat logs from Talishar.net and export to PT-BR Excel CSV or Google Sheets',
    version: '0.1.0',
    permissions: ['storage', 'downloads'],
    host_permissions: ['*://*.talishar.net/*'],
    browser_specific_settings: {
      gecko: {
        id: 'talishar-log-exporter@renan',
        strict_min_version: '109.0',
      },
    },
  },
});
