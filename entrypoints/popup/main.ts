import { storage } from 'wxt/storage';

const webhookInput = document.getElementById('webhook-url') as HTMLInputElement | null;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null;
const statusDiv = document.getElementById('status') as HTMLDivElement | null;

async function loadSettings() {
  const webhookUrl = await storage.getItem<string>('local:googleSheetsWebhookUrl');
  if (webhookInput && webhookUrl) {
    webhookInput.value = webhookUrl;
  }
}

async function saveSettings() {
  if (!webhookInput || !statusDiv) return;
  const url = webhookInput.value.trim();
  await storage.setItem('local:googleSheetsWebhookUrl', url);
  statusDiv.textContent = 'Configurações salvas com sucesso!';
  statusDiv.style.color = '#4ade80';
  setTimeout(() => {
    if (statusDiv) statusDiv.textContent = '';
  }, 3000);
}

saveBtn?.addEventListener('click', saveSettings);
loadSettings();
