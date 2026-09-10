import { defineBackground } from 'wxt/sandbox';
import { sendMatchToSheets, testSheetsConnection } from '../src/services/sheetsClient';

export default defineBackground(() => {
  console.log('[Talishar Log Exporter] Background service initialized.');

  browser.runtime.onMessage.addListener((message: any) => {
    if (message?.type === 'SEND_TO_SHEETS') {
      return sendMatchToSheets(message.match, message.webhookUrl);
    }

    if (message?.type === 'TEST_SHEETS_CONNECTION') {
      return testSheetsConnection(message.webhookUrl);
    }

    return undefined;
  });
});
