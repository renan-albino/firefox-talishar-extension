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

    if (message?.type === 'OPEN_EXPORT_WINDOW') {
      if (message.match) {
        try {
          await browser.storage.local.set({ activeExportMatch: message.match });
        } catch (e) {
          console.error('[Talishar Log Exporter] Falha ao gravar partida ativa para exportação:', e);
        }
      }

      const exportUrl = browser.runtime.getURL('/export.html');
      try {
        await browser.windows.create({
          url: exportUrl,
          type: 'popup',
          width: 640,
          height: 780,
          focused: true,
        });
      } catch (err) {
        console.warn('[Talishar Log Exporter] Falha ao abrir janela popup, abrindo nova aba:', err);
        await browser.tabs.create({ url: exportUrl, active: true });
      }

      return { success: true };
    }

    if (message?.type === 'DOWNLOAD_FILE') {
      try {
        const mimeType = message.mimeType || 'text/plain';
        const dataUrl = `data:${mimeType};charset=utf-8,${encodeURIComponent(message.content || '')}`;
        const downloadId = await browser.downloads.download({
          url: dataUrl,
          filename: message.filename,
          saveAs: false,
        });
        return { success: true, downloadId };
      } catch (err: any) {
        console.warn('[Talishar Log Exporter] Erro no download com data URL, tentando blob:', err);
        try {
          const mimeType = message.mimeType || 'text/plain';
          const blob = new Blob([message.content || ''], { type: `${mimeType};charset=utf-8;` });
          const blobUrl = URL.createObjectURL(blob);
          const downloadId = await browser.downloads.download({
            url: blobUrl,
            filename: message.filename,
            saveAs: false,
          });
          setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
          return { success: true, downloadId };
        } catch (err2: any) {
          console.error('[Talishar Log Exporter] Erro ao executar browser.downloads.download:', err2);
          return { success: false, error: err2?.message };
        }
      }
    }

    return undefined;
  });
});
