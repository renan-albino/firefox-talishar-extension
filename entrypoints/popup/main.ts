import { getSettings, saveSettings, getMatchHistory, importMatchesFromCsv } from '../../src/utils/storage';
import { testSheetsConnection, validateWebhookUrl, type SheetsResponse } from '../../src/services/sheetsClient';
import { formatMatchHistoryCsv, formatFullLogText } from '../../src/formatters/csvFormatter';

const webhookInput = document.getElementById('webhook-url') as HTMLInputElement | null;
const spreadsheetInput = document.getElementById('spreadsheet-url') as HTMLInputElement | null;
const playerNameInput = document.getElementById('player-name') as HTMLInputElement | null;
const autoOpenInput = document.getElementById('auto-open') as HTMLInputElement | null;
const openSheetBtn = document.getElementById('open-sheet-btn') as HTMLButtonElement | null;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null;
const testBtn = document.getElementById('test-btn') as HTMLButtonElement | null;
const statusDiv = document.getElementById('status') as HTMLDivElement | null;
const statsStatusDiv = document.getElementById('stats-status') as HTMLDivElement | null;

function setStatus(msg: string, isError = false, el = statusDiv) {
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#f87171' : '#4ade80';
}

async function initDashboard() {
  const history = await getMatchHistory();
  const countEl = document.getElementById('dash-matches-count');
  if (countEl) countEl.textContent = `${history.length} partidas`;
  
  if (history.length === 0) return;

  const wins = history.filter(m => m.result === 'win').length;
  const wr = (wins / history.length * 100).toFixed(1);
  const wrEl = document.getElementById('dash-winrate');
  if (wrEl) {
    wrEl.textContent = `${wr}%`;
    if (wins / history.length >= 0.5) {
       wrEl.classList.add('win');
       wrEl.classList.remove('loss');
    } else {
       wrEl.classList.add('loss');
       wrEl.classList.remove('win');
    }
  }

  const heroCounts: Record<string, number> = {};
  const opponentMatchups: Record<string, { w: number, l: number }> = {};

  history.forEach(m => {
    const hero = m.player.hero || '-';
    heroCounts[hero] = (heroCounts[hero] || 0) + 1;
    
    const opp = m.opponent.hero || '-';
    if (!opponentMatchups[opp]) opponentMatchups[opp] = { w: 0, l: 0 };
    if (m.result === 'win') opponentMatchups[opp].w++;
    if (m.result === 'loss') opponentMatchups[opp].l++;
  });

  const mainHero = Object.keys(heroCounts).reduce((a, b) => heroCounts[a] > heroCounts[b] ? a : b, '-');
  const mainHeroEl = document.getElementById('dash-main-hero');
  if (mainHeroEl) mainHeroEl.textContent = mainHero;

  let bestMatchup = '-';
  let bestMatchupScore = -1;
  let worstMatchup = '-';
  let worstMatchupScore = 999;

  Object.entries(opponentMatchups).forEach(([opp, stats]) => {
    const total = stats.w + stats.l;
    if (total >= 1) {
      const rate = stats.w / total;
      // Prefer matchups with more games if winrate is similar (optional, but keep simple)
      if (rate > bestMatchupScore || (rate === bestMatchupScore && total > (opponentMatchups[bestMatchup]?.w || 0))) {
        bestMatchupScore = rate;
        bestMatchup = opp;
      }
      if (rate < worstMatchupScore) {
        worstMatchupScore = rate;
        worstMatchup = opp;
      }
    }
  });

  const formatHero = (h: string) => {
    if (h === '-' || !h) return '-';
    const words = h.split(' ');
    if (words.length > 2) return `${words[0]} ${words[1]}`;
    return words[0]; 
  }

  const bestEl = document.getElementById('dash-best-matchup');
  const worstEl = document.getElementById('dash-worst-matchup');
  if (bestEl) bestEl.textContent = formatHero(bestMatchup);
  if (worstEl) worstEl.textContent = formatHero(worstMatchup);
}

async function init() {
  const settings = await getSettings();
  if (playerNameInput) playerNameInput.value = settings.playerName || '';
  if (webhookInput) webhookInput.value = settings.googleSheetsWebhookUrl || '';
  if (spreadsheetInput) spreadsheetInput.value = settings.googleSpreadsheetUrl || '';
  if (autoOpenInput) autoOpenInput.checked = Boolean(settings.autoOpenNotesModal);

  // Tabs
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-target')!)?.classList.add('active');
    });
  });

  // Check live status
  try {
    const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTab = activeTabs[0];
    const banner = document.getElementById('live-status-banner');
    const dot = document.getElementById('live-status-dot');
    const txt = document.getElementById('live-status-text');
    
    if (currentTab && banner && dot && txt) {
      if (!currentTab.url?.includes('talishar.net')) {
        banner.style.background = '#374151';
        banner.style.color = '#9ca3af';
        dot.style.background = '#9ca3af';
        txt.textContent = 'Fora do site Talishar (Inativo)';
      } else {
        // Send a ping message to the content script in this tab
        try {
          const res = (await browser.tabs.sendMessage(currentTab.id!, { type: 'PING_STATUS' })) as
            | { status?: string }
            | undefined;
          if (res?.status === 'active') {
            banner.style.background = 'rgba(16, 185, 129, 0.15)';
            banner.style.border = '1px solid rgba(16, 185, 129, 0.4)';
            banner.style.color = '#10b981';
            dot.style.background = '#10b981';
            txt.textContent = 'Conectado: Lendo dados da partida';
          } else {
            banner.style.background = 'rgba(239, 68, 68, 0.15)';
            banner.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            banner.style.color = '#ef4444';
            dot.style.background = '#ef4444';
            txt.textContent = 'Aguardando partida (Erro / Não Detectado)';
          }
        } catch {
          // No response from content script
          banner.style.background = 'rgba(239, 68, 68, 0.15)';
          banner.style.border = '1px solid rgba(239, 68, 68, 0.4)';
          banner.style.color = '#ef4444';
          dot.style.background = '#ef4444';
          txt.textContent = 'Falha ao conectar: Atualize a página do Talishar';
        }
      }
    }
  } catch (err) {
    // browser.tabs might not be available in some environments
  }

  // Export Last Match Manually
  const exportLastMatchBtn = document.getElementById('export-last-match-btn');
  const exportLastMatchStatus = document.getElementById('export-last-match-status') as HTMLDivElement | null;

  const showExportStatus = (msg: string, isError = false) => {
    if (!exportLastMatchStatus) return;
    exportLastMatchStatus.textContent = msg;
    exportLastMatchStatus.style.display = 'block';
    exportLastMatchStatus.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    exportLastMatchStatus.style.border = isError ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)';
    exportLastMatchStatus.style.color = isError ? '#f87171' : '#34d399';
  };

  exportLastMatchBtn?.addEventListener('click', async () => {
    try {
      const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
      const currentTab = activeTabs[0];
      if (currentTab && currentTab.url?.includes('talishar.net')) {
        exportLastMatchBtn.innerText = 'Abrindo Painel no Jogo...';
        const res = (await browser.tabs.sendMessage(currentTab.id!, { type: 'OPEN_MODAL_LAST_MATCH' })) as
          | { success?: boolean; reason?: string }
          | undefined;

        if (res?.success) {
          exportLastMatchBtn.innerText = 'Painel Aberto no Jogo! ✅';
          showExportStatus('Painel aberto com sucesso! Alternando para o jogo...', false);
          setTimeout(() => window.close(), 800); // close popup
        } else {
          exportLastMatchBtn.innerText = '📝 Salvar/Exportar Última Partida Jogada';
          showExportStatus(res?.reason || 'Não foi possível encontrar a partida na tela ou no histórico.', true);
        }
      } else {
        showExportStatus('⚠️ Abra a aba do Talishar (talishar.net) para visualizar o painel no jogo.', true);
      }
    } catch (err) {
      exportLastMatchBtn.innerText = '📝 Salvar/Exportar Última Partida Jogada';
      showExportStatus('⚠️ Não foi possível conectar ao Talishar. Recarregue a aba do jogo (F5) e tente novamente.', true);
    }
  });

  // Export Full Log (.txt)
  document.getElementById('export-log-btn')?.addEventListener('click', async () => {
    let targetMatch = null;
    const history = await getMatchHistory();
    if (history.length > 0) {
      targetMatch = history[history.length - 1];
    } else {
      // Try fetching current match on screen from active tab
      try {
        const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
        const currentTab = activeTabs[0];
        if (currentTab && currentTab.url?.includes('talishar.net')) {
          const res = (await browser.tabs.sendMessage(currentTab.id!, { type: 'GET_CURRENT_MATCH' })) as
            | { success?: boolean; match?: any }
            | undefined;
          if (res?.success && res.match) {
            targetMatch = res.match;
          }
        }
      } catch {
        // Ignore
      }
    }

    if (!targetMatch) {
      setStatus('Nenhum log de partida disponível para download.', true, statsStatusDiv);
      return;
    }

    const logText = formatFullLogText(targetMatch);
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talishar-${targetMatch.id || Date.now()}-log.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    setStatus('Download do log (.txt) iniciado! ✅', false, statsStatusDiv);
    setTimeout(() => setStatus('', false, statsStatusDiv), 3000);
  });

  // Export CSV
  document.getElementById('export-csv-btn')?.addEventListener('click', async () => {
    const history = await getMatchHistory();
    if (history.length === 0) {
      setStatus('Nenhum dado para exportar.', true, statsStatusDiv);
      return;
    }
    const csv = formatMatchHistoryCsv(history);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'talishar_historico_partidas.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatus('Download iniciado! ✅', false, statsStatusDiv);
    setTimeout(() => setStatus('', false, statsStatusDiv), 3000);
  });

  // Import CSV
  const fileInput = document.getElementById('import-csv-file') as HTMLInputElement;
  fileInput?.addEventListener('change', async (e) => {
    const file = fileInput.files?.[0];
    if (!file) return;
    setStatus('Lendo arquivo... ⏳', false, statsStatusDiv);
    try {
      const text = await file.text();
      const importedCount = await importMatchesFromCsv(text);
      setStatus(`Importadas ${importedCount} partidas com sucesso! ✅`, false, statsStatusDiv);
      initDashboard();
    } catch (err: any) {
      setStatus(`Erro ao importar: ${err.message}`, true, statsStatusDiv);
    }
  });

  initDashboard();
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

    try {
      res = (await browser.runtime.sendMessage({
        type: 'TEST_SHEETS_CONNECTION',
        webhookUrl: validation.url,
      })) as SheetsResponse | undefined;
    } catch {
      // Fallback
    }

    if (!res) res = await testSheetsConnection(validation.url);

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
