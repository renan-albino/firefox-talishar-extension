import { getSettings, saveSettings } from '../../src/utils/storage';
import { testSheetsConnection } from '../../src/services/sheetsClient';

const webhookInput = document.getElementById('webhook-url') as HTMLInputElement | null;
const autoOpenInput = document.getElementById('auto-open') as HTMLInputElement | null;
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
  if (webhookInput) {
    webhookInput.value = settings.googleSheetsWebhookUrl || '';
  }
  if (autoOpenInput) {
    autoOpenInput.checked = Boolean(settings.autoOpenNotesModal);
  }
}

async function handleSave() {
  const url = webhookInput?.value.trim() || '';
  const autoOpen = Boolean(autoOpenInput?.checked);

  await saveSettings({
    googleSheetsWebhookUrl: url,
    autoOpenNotesModal: autoOpen,
  });

  setStatus('Configurações salvas com sucesso!');
  setTimeout(() => setStatus(''), 3000);
}

async function handleTest() {
  const url = webhookInput?.value.trim() || '';
  if (!url) {
    setStatus('Por favor, informe uma URL de Webhook antes de testar.', true);
    return;
  }

  setStatus('Testando conexão com o Google Sheets...');
  if (testBtn) testBtn.disabled = true;

  try {
    const res = await testSheetsConnection(url);
    if (res.success) {
      setStatus('Conexão estabelecida com sucesso! ✅');
    } else {
      setStatus(`Erro: ${res.error || 'Falha na conexão'} ❌`, true);
    }
  } catch (err: any) {
    setStatus(`Erro: ${err?.message || 'Falha na conexão'} ❌`, true);
  } finally {
    if (testBtn) testBtn.disabled = false;
  }
}

saveBtn?.addEventListener('click', handleSave);
testBtn?.addEventListener('click', handleTest);

init();
