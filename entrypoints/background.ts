import { defineBackground } from 'wxt/sandbox';
import { sendMatchToSheets, testSheetsConnection } from '../src/services/sheetsClient';
import { getSettings } from '../src/utils/storage';

export default defineBackground(() => {
  console.log('[Talishar Log Exporter] Background service initialized.');

  browser.runtime.onMessage.addListener(async (message: any) => {
    if (message?.type === 'SEND_TO_SHEETS') {
      const settings = await getSettings();
      const webhookUrl = message.webhookUrl || settings.googleSheetsWebhookUrl;
      return sendMatchToSheets(message.match, webhookUrl);
    }

    if (message?.type === 'TEST_SHEETS_CONNECTION') {
      const settings = await getSettings();
      const webhookUrl = message.webhookUrl || settings.googleSheetsWebhookUrl;
      return testSheetsConnection(webhookUrl);
    }

    return undefined;
  });
});
