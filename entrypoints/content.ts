import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.talishar.net/*'],
  main() {
    console.log('[Talishar Log Exporter] Content script initialized on talishar.net');
  },
});
