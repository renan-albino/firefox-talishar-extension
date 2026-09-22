import { getSettings, saveSettings } from '../../src/utils/storage';
import { testSheetsConnection, validateWebhookUrl, type SheetsResponse } from '../../src/services/sheetsClient';

const webhookInput = document.getElementById('webhook-url') as HTMLInputElement | null;
const spreadsheetInput = document.getElementById('spreadsheet-url') as HTMLInputElement | null;
const playerNameInput = document.getElementById('player-name') as HTMLInputElement | null;
const autoOpenInput = document.getElementById('auto-open') as HTMLInputElement | null;
const openSheetBtn = document.getElementById('open-sheet-btn') as HTMLButtonElement | null;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null;
const testBtn = document.getElementById('test-btn') as HTMLButtonElement | null;
const statusDiv = document.getElementById('status') as HTMLDivElement | null;

function setStatus(msg: string, isError = false) {
  if (!statusDiv) return;
  statusDiv.textContent = msg;
  statusDiv.style.color = isError ? '#f87171' : '#4ade80';
}

async function init() {
  const settings = await getSettings();
  if (playerNameInput) {
    playerNameInput.value = settings.playerName || '';
  }
  if (webhookInput) {
    webhookInput.value = settings.googleSheetsWebhookUrl || '';
  }
  if (spreadsheetInput) {
    spreadsheetInput.value = settings.googleSpreadsheetUrl || '';
  }
  if (autoOpenInput) {
    autoOpenInput.checked = Boolean(settings.autoOpenNotesModal);
  }
}

async function handleSave() {
  const playerName = playerNameInput?.value.trim() || '';
  const url = webhookInput?.value.trim() || '';
  const spreadsheetUrl = spreadsheetInput?.value.trim() || '';
  const autoOpen = Boolean(autoOpenInput?.checked);

  if (url) {
    const val = validateWebhookUrl(url);
    if (!val.valid) {
      setStatus(`Erro no Webhook: ${val.error}`, true);
      return;
    }
  }

  await saveSettings({
    playerName,
    googleSheetsWebhookUrl: url,
    googleSpreadsheetUrl: spreadsheetUrl,
    autoOpenNotesModal: autoOpen,
  });

  setStatus('Configurações salvas com sucesso!');
  setTimeout(() => setStatus(''), 3000);
}

function handleOpenSheet() {
  const sheetUrl = spreadsheetInput?.value.trim();
  const webhookUrl = webhookInput?.value.trim();
  const target = sheetUrl || webhookUrl;

  if (target) {
    if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.create) {
      browser.tabs.create({ url: target });
    } else {
      window.open(target, '_blank');
    }
  } else {
    setStatus('Cadastre o link da planilha ou a URL do Webhook primeiro.', true);
  }
}

async function handleTest() {
  const url = webhookInput?.value.trim() || '';
  if (!url) {
    setStatus('Por favor, informe uma URL de Webhook antes de testar.', true);
    return;
  }

  const validation = validateWebhookUrl(url);
  if (!validation.valid) {
    setStatus(`Erro na URL: ${validation.error}`, true);
    return;
  }

  setStatus('Testando conexão com o Google Sheets... ⏳');
  if (testBtn) {
    testBtn.disabled = true;
    testBtn.textContent = 'Testando... ⏳';
  }

  try {
    let res: SheetsResponse | undefined;

    // Dispara via background script para garantir permissões totais de rede
    try {
      res = (await browser.runtime.sendMessage({
        type: 'TEST_SHEETS_CONNECTION',
        webhookUrl: validation.url,
      })) as SheetsResponse | undefined;
    } catch {
      // Caso o background não responda, faz o fallback direto
    }

    if (!res) {
      res = await testSheetsConnection(validation.url);
    }

    if (res.success) {
      setStatus('Conexão estabelecida com sucesso! ✅');
    } else {
      setStatus(`Erro: ${res.error || 'Falha na conexão'} ❌`, true);
    }
  } catch (err: any) {
    setStatus(`Erro: ${err?.message || 'Falha na conexão'} ❌`, true);
  } finally {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.textContent = 'Testar Conexão';
    }
  }
}

saveBtn?.addEventListener('click', handleSave);
testBtn?.addEventListener('click', handleTest);
openSheetBtn?.addEventListener('click', handleOpenSheet);

init();
