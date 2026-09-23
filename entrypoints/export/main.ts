import { getSettings, getMatchHistory, saveMatchToHistory } from '../../src/utils/storage';
import { formatMatchSummaryCsv, formatFullLogText } from '../../src/formatters/csvFormatter';
import type { MatchRecord } from '../../src/types/match';
import type { SheetsResponse } from '../../src/services/sheetsClient';

function formatDecimal(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return Number.isInteger(val) ? `${val},0` : String(val).replace('.', ',');
}

function parseDecimal(s?: string): number | undefined {
  if (!s || s === '-') return undefined;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? undefined : n;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

let currentMatch: MatchRecord | null = null;

const displayMatchId = document.getElementById('display-match-id') as HTMLElement;
const displayResult = document.getElementById('display-result') as HTMLElement;
const displayTime = document.getElementById('display-time') as HTMLElement;
const displayPlayerHero = document.getElementById('display-player-hero') as HTMLElement;
const displayOppHero = document.getElementById('display-opp-hero') as HTMLElement;
const displayPlayerAvg = document.getElementById('display-player-avg') as HTMLElement;
const displayOppAvg = document.getElementById('display-opp-avg') as HTMLElement;
const summaryCard = document.getElementById('summary-card') as HTMLElement;

const oppAlertBox = document.getElementById('opp-alert-box') as HTMLElement;
const oppAlertText = document.getElementById('opp-alert-text') as HTMLElement;
const btnSyncStats = document.getElementById('btn-sync-stats') as HTMLButtonElement;

const inputPlayerName = document.getElementById('input-player-name') as HTMLInputElement;
const selectWentFirst = document.getElementById('select-went-first') as HTMLSelectElement;
const inputPlayerAvg = document.getElementById('input-player-avg') as HTMLInputElement;
const inputOppAvg = document.getElementById('input-opp-avg') as HTMLInputElement;
const textareaNotes = document.getElementById('textarea-notes') as HTMLTextAreaElement;
const inputSideboard = document.getElementById('input-sideboard') as HTMLInputElement;
const exportStatus = document.getElementById('export-status') as HTMLElement;

const btnSaveSheets = document.getElementById('btn-save-sheets') as HTMLButtonElement;
const btnOpenSheet = document.getElementById('btn-open-sheet') as HTMLButtonElement;
const btnDownloadCsv = document.getElementById('btn-download-csv') as HTMLButtonElement;
const btnDownloadLog = document.getElementById('btn-download-log') as HTMLButtonElement;
const btnCloseWindow = document.getElementById('btn-close-window') as HTMLButtonElement;

function setStatus(msg: string, isError = false) {
  if (!exportStatus) return;
  exportStatus.textContent = msg;
  exportStatus.style.color = isError ? '#f87171' : '#34d399';
}

function updateOpponentAlert(oppAvg?: number) {
  const hasOppAvg = oppAvg !== undefined && !isNaN(oppAvg);
  if (hasOppAvg) {
    oppAlertBox?.classList.add('success');
    if (oppAlertText) {
      oppAlertText.innerHTML = `✅ Valor Médio do Oponente capturado (<strong>${formatDecimal(oppAvg)}</strong>)`;
    }
  } else {
    oppAlertBox?.classList.remove('success');
    if (oppAlertText) {
      oppAlertText.innerHTML = `💡 <strong>Dica:</strong> No Talishar, clique na aba do oponente nas estatísticas ou insira manualmente abaixo.`;
    }
  }
}

function renderMatch(match: MatchRecord) {
  currentMatch = match;

  if (displayMatchId) displayMatchId.textContent = match.id || 'Nova Partida';

  const isWin = match.result === 'win';
  const isLoss = match.result === 'loss';
  const resultLabel = isWin ? 'Vitória' : isLoss ? 'Derrota' : match.result === 'draw' ? 'Empate' : 'Partida Registrada';
  const resultColor = isWin ? '#10b981' : isLoss ? '#ef4444' : '#f59e0b';

  if (displayResult) {
    displayResult.textContent = `${resultLabel} (${match.turnsCount ?? 1} turnos)`;
    displayResult.style.color = resultColor;
  }
  if (summaryCard) {
    summaryCard.style.borderLeftColor = resultColor;
  }

  const timeStr = match.timestamp ? new Date(match.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  if (displayTime) displayTime.textContent = timeStr;

  if (displayPlayerHero) displayPlayerHero.textContent = match.player?.hero || 'Meu Herói';
  if (displayOppHero) displayOppHero.textContent = match.opponent?.hero || 'Herói Oponente';

  if (displayPlayerAvg) displayPlayerAvg.textContent = formatDecimal(match.player?.avgTurnValue);
  if (displayOppAvg) displayOppAvg.textContent = formatDecimal(match.opponent?.avgTurnValue);

  updateOpponentAlert(match.opponent?.avgTurnValue);

  if (inputPlayerName) inputPlayerName.value = match.player?.name || 'Jogador';
  if (selectWentFirst) {
    selectWentFirst.value = match.wentFirst === true ? 'true' : match.wentFirst === false ? 'false' : '';
  }
  if (inputPlayerAvg) {
    inputPlayerAvg.value = match.player?.avgTurnValue !== undefined ? formatDecimal(match.player.avgTurnValue) : '';
  }
  if (inputOppAvg) {
    inputOppAvg.value = match.opponent?.avgTurnValue !== undefined ? formatDecimal(match.opponent.avgTurnValue) : '';
  }
  if (textareaNotes) textareaNotes.value = match.notes || '';
  if (inputSideboard) {
    inputSideboard.value = (match.sideboardCards || []).join(', ');
  }
}

function getUpdatedMatch(): MatchRecord {
  if (!currentMatch) {
    throw new Error('Nenhuma partida carregada');
  }

  const wentFirstVal = selectWentFirst?.value;
  const wentFirst = wentFirstVal === 'true' ? true : wentFirstVal === 'false' ? false : undefined;
  const playerAvg = parseDecimal(inputPlayerAvg?.value) ?? currentMatch.player.avgTurnValue;
  const oppAvg = parseDecimal(inputOppAvg?.value) ?? currentMatch.opponent.avgTurnValue;
  const playerName = inputPlayerName?.value.trim() || currentMatch.player.name || 'Jogador';
  const notes = textareaNotes?.value.trim() || '';
  const sideboard = inputSideboard?.value
    ? inputSideboard.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    ...currentMatch,
    player: {
      ...currentMatch.player,
      name: playerName,
      avgTurnValue: playerAvg,
    },
    opponent: {
      ...currentMatch.opponent,
      avgTurnValue: oppAvg,
    },
    wentFirst,
    notes,
    sideboardCards: sideboard,
  };
}

async function init() {
  const settings = await getSettings();

  // Show open sheet button if spreadsheet link exists
  const targetSheetUrl = settings.googleSpreadsheetUrl || settings.googleSheetsWebhookUrl;
  if (targetSheetUrl && btnOpenSheet) {
    btnOpenSheet.style.display = 'flex';
    btnOpenSheet.addEventListener('click', () => {
      window.open(targetSheetUrl, '_blank');
    });
  }

  // Load match from active export storage or match history
  let matchToLoad: MatchRecord | null = null;
  try {
    const localData = await browser.storage.local.get('activeExportMatch');
    if (localData && (localData as any).activeExportMatch) {
      matchToLoad = (localData as any).activeExportMatch;
    }
  } catch {
    // Ignore
  }

  if (!matchToLoad) {
    const history = await getMatchHistory();
    if (history.length > 0) {
      matchToLoad = history[history.length - 1];
    }
  }

  if (!matchToLoad) {
    // Default placeholder match
    matchToLoad = {
      id: `talishar-${Date.now()}`,
      timestamp: new Date().toISOString(),
      player: {
        name: settings.playerName?.trim() || 'Jogador',
        hero: '-',
      },
      opponent: {
        name: 'Oponente',
        hero: '-',
      },
      result: 'unknown',
      turnsCount: 1,
      sideboardCards: [],
      playerEquipment: [],
      opponentEquipment: [],
      notes: '',
      rawLogs: [],
      format: 'CC',
      wentFirst: undefined,
      platform: 'Talishar',
    };
  }

  // Apply default configured player name if unset
  if (settings.playerName?.trim() && (!matchToLoad.player.name || matchToLoad.player.name === 'Jogador')) {
    matchToLoad.player.name = settings.playerName.trim();
  }

  renderMatch(matchToLoad);

  // Sync stats from active Talishar tab
  btnSyncStats?.addEventListener('click', async () => {
    btnSyncStats.disabled = true;
    btnSyncStats.textContent = 'Buscando... ⏳';
    setStatus('Consultando a página do Talishar...');

    try {
      const tabs = await browser.tabs.query({ url: '*://*.talishar.net/*' });
      if (tabs.length === 0) {
        setStatus('Aba do Talishar não encontrada. Você pode preencher o valor manualmente.', true);
        return;
      }

      const activeTalisharTab = tabs.find((t) => t.active) || tabs[0];
      const res = (await browser.tabs.sendMessage(activeTalisharTab.id!, {
        type: 'GET_CURRENT_MATCH',
      })) as { success?: boolean; match?: Partial<MatchRecord> } | undefined;

      if (res?.success && res.match) {
        const liveMatch = res.match;
        if (liveMatch.opponent?.avgTurnValue !== undefined) {
          if (inputOppAvg) inputOppAvg.value = formatDecimal(liveMatch.opponent.avgTurnValue);
          if (displayOppAvg) displayOppAvg.textContent = formatDecimal(liveMatch.opponent.avgTurnValue);
          updateOpponentAlert(liveMatch.opponent.avgTurnValue);
        }
        if (liveMatch.player?.avgTurnValue !== undefined) {
          if (inputPlayerAvg) inputPlayerAvg.value = formatDecimal(liveMatch.player.avgTurnValue);
          if (displayPlayerAvg) displayPlayerAvg.textContent = formatDecimal(liveMatch.player.avgTurnValue);
        }
        setStatus('Estatísticas atualizadas com sucesso a partir do jogo! ✅');
      } else {
        setStatus('Nenhum dado novo encontrado na tela do jogo.', true);
      }
    } catch (err: any) {
      setStatus(`Erro ao consultar o jogo: ${err?.message || 'Aba não respondeu'}`, true);
    } finally {
      btnSyncStats.disabled = false;
      btnSyncStats.textContent = '🔄 Sincronizar do Jogo';
    }
  });

  // Save to Google Sheets
  btnSaveSheets?.addEventListener('click', async () => {
    btnSaveSheets.disabled = true;
    btnSaveSheets.textContent = 'Salvando no Google Sheets... ⏳';
    setStatus('Enviando dados para o Google Sheets...');

    try {
      const updated = getUpdatedMatch();
      const currentSettings = await getSettings();

      const response = (await browser.runtime.sendMessage({
        type: 'SEND_TO_SHEETS',
        match: updated,
        webhookUrl: currentSettings.googleSheetsWebhookUrl,
      })) as SheetsResponse | undefined;

      if (response?.success) {
        await saveMatchToHistory(updated);
        await browser.storage.local.set({ activeExportMatch: updated });
        currentMatch = updated;
        setStatus('Partida salva no Google Sheets e no Histórico com sucesso! ✅');
      } else {
        setStatus(`Erro ao salvar: ${response?.error || 'Falha de comunicação com o Webhook'} ❌`, true);
      }
    } catch (err: any) {
      setStatus(`Erro: ${err?.message || 'Falha ao salvar'} ❌`, true);
    } finally {
      btnSaveSheets.disabled = false;
      btnSaveSheets.textContent = '📊 Salvar no Google Sheets';
    }
  });

  // Download CSV
  btnDownloadCsv?.addEventListener('click', () => {
    try {
      const updated = getUpdatedMatch();
      const csv = formatMatchSummaryCsv(updated);
      triggerDownload(csv, `talishar-${updated.id}.csv`, 'text/csv');
      setStatus('Download do arquivo CSV iniciado! ✅');
    } catch (err: any) {
      setStatus(`Erro ao gerar CSV: ${err?.message}`, true);
    }
  });

  // Download Full Log (.txt)
  btnDownloadLog?.addEventListener('click', () => {
    try {
      const updated = getUpdatedMatch();
      const log = formatFullLogText(updated);
      triggerDownload(log, `talishar-${updated.id}-log.txt`, 'text/plain');
      setStatus('Download do log (.txt) iniciado! ✅');
    } catch (err: any) {
      setStatus(`Erro ao gerar Log: ${err?.message}`, true);
    }
  });

  // Close Window
  btnCloseWindow?.addEventListener('click', () => {
    window.close();
  });
}

init();
