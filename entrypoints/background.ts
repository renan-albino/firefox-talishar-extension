import { defineBackground } from 'wxt/sandbox';
import { sendMatchToSheets, testSheetsConnection } from '../src/services/sheetsClient';
import { getSettings } from '../src/utils/storage';

export default defineBackground(() => {
  console.log('[Talishar Log Exporter] Background service initialized.');

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url && tab.url.includes('talishar.net')) {
      // Default to red when on Talishar until content script says otherwise
      browser.action.setIcon({ path: '/icon-red.png', tabId });
      browser.action.setBadgeText({ text: 'OFF', tabId });
      browser.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
    } else if (tab.url && !tab.url.includes('talishar.net')) {
      browser.action.setIcon({ path: '/icon-gray.png', tabId });
      browser.action.setBadgeText({ text: '', tabId });
    }
  });

  browser.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await browser.tabs.get(activeInfo.tabId);
      if (tab.url && !tab.url.includes('talishar.net')) {
        browser.action.setIcon({ path: '/icon-gray.png', tabId: activeInfo.tabId });
        browser.action.setBadgeText({ text: '', tabId: activeInfo.tabId });
      }
    } catch {
      // Ignore
    }
  });

  browser.runtime.onMessage.addListener(async (message: any, sender: any) => {
    if (message?.type === 'UPDATE_STATUS') {
      const tabId = sender.tab?.id;
      if (tabId) {
        if (message.status === 'active') {
          browser.action.setIcon({ path: '/icon-green.png', tabId });
          browser.action.setBadgeText({ text: 'ON', tabId });
          browser.action.setBadgeBackgroundColor({ color: '#10b981', tabId });
        } else if (message.status === 'error') {
          browser.action.setIcon({ path: '/icon-red.png', tabId });
          browser.action.setBadgeText({ text: 'ERR', tabId });
          browser.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
        }
      }
      return { success: true };
    }

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
