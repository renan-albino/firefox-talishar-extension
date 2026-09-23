import type { MatchRecord } from '../types/match';
import { formatMatchSummaryCsv, formatFullLogText } from '../formatters/csvFormatter';
import type { SheetsResponse } from '../services/sheetsClient';
import { findOpponentTabElement } from '../parsers/talisharDom';

export interface ModalOptions {
  match: MatchRecord;
  webhookUrl?: string;
  spreadsheetUrl?: string;
  onSaveToSheets: (match: MatchRecord) => Promise<SheetsResponse>;
  onRefreshStats?: () => { playerAvgTurnValue?: number; opponentAvgTurnValue?: number };
  onClose: () => void;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
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

function formatDecimal(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return Number.isInteger(val) ? `${val},0` : String(val).replace('.', ',');
}

export function createExportModal(options: ModalOptions): HTMLElement {
  const { match, webhookUrl, spreadsheetUrl, onSaveToSheets, onRefreshStats, onClose } = options;

  const overlay = document.createElement('div');
  overlay.id = 'talishar-export-modal';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 10, 15, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const isWin = match.result === 'win';
  const resultColor = isWin ? '#10b981' : match.result === 'loss' ? '#ef4444' : '#f59e0b';
  const resultLabel = isWin ? 'Vitória' : match.result === 'loss' ? 'Derrota' : 'Empate';

  const container = document.createElement('div');
  container.style.cssText = `
    background: #181822;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    width: 540px;
    max-width: 92vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    color: #f3f4f6;
    padding: 24px;
    box-sizing: border-box;
    pointer-events: auto;
    position: absolute;
    top: 5vh;
    left: 50%;
    transform: translateX(-50%);
  `;

  const hasOpponentAvg = match.opponent.avgTurnValue !== undefined && !isNaN(match.opponent.avgTurnValue);

  container.innerHTML = `
    <div id="modal-drag-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; cursor: grab;">
      <h2 style="margin: 0; font-size: 18px; color: #ff7043; display: flex; align-items: center; gap: 8px;">
        ⚔️ Salvar e Exportar Partida
      </h2>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button id="modal-minimize-btn" title="Minimizar para interagir com o jogo" style="
          background: #242433;
          border: 1px solid #374151;
          color: #cfd8dc;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        ">👁️ Ver Jogo / Minimizar</button>
        <button id="modal-close-icon" style="background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; line-height: 1;">&times;</button>
      </div>
    </div>

    <!-- Match Summary Card -->
    <div style="background: #232332; border-radius: 8px; padding: 14px; margin-bottom: 16px; border-left: 4px solid ${resultColor};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 700; font-size: 15px; color: ${resultColor};">${resultLabel} (${match.turnsCount} turnos)</span>
        <span style="font-size: 12px; color: #9ca3af;">${new Date(match.timestamp).toLocaleTimeString()}</span>
      </div>
      <div style="font-size: 13px; margin-bottom: 8px;">
        <strong>${match.player.hero || 'Meu Herói'}</strong> <em>vs</em> <strong>${match.opponent.hero || 'Herói Oponente'}</strong>
      </div>
      <div style="display: flex; gap: 16px; font-size: 12px; color: #d1d5db;">
        <div>Meu Valor Médio/Turno: <strong style="color: #6ee7b7;">${formatDecimal(match.player.avgTurnValue)}</strong></div>
        <div>Oponente: <strong id="modal-opp-value" style="color: #fca5a5;">${formatDecimal(match.opponent.avgTurnValue)}</strong></div>
      </div>

      <!-- Opponent Stats Banner / Instruction -->
      <div id="modal-opp-alert" style="
        background: ${hasOpponentAvg ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
        border: 1px solid ${hasOpponentAvg ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
        border-radius: 6px;
        padding: 9px 12px;
        margin-top: 10px;
        font-size: 12px;
        color: ${hasOpponentAvg ? '#6ee7b7' : '#fca5a5'};
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      ">
        <span id="modal-opp-alert-text" style="flex: 1; min-width: 200px;">
          ${hasOpponentAvg
            ? `✅ Valor Médio do Oponente capturado (${formatDecimal(match.opponent.avgTurnValue)})`
            : '💡 <strong>Dica:</strong> Alterne para a <u>aba do Oponente</u> nas estatísticas do Talishar para registrar o Valor Médio dele!'}
        </span>
        <div style="display: flex; gap: 6px;">
          <button id="modal-switch-opp-tab-btn" type="button" style="
            background: #ff7043;
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
          ">👆 Alternar no Jogo</button>
          <button id="modal-refresh-stats-btn" type="button" style="
            background: #374151;
            color: #fff;
            border: 1px solid #4b5563;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
            white-space: nowrap;
          ">🔄 Atualizar</button>
        </div>
      </div>
    </div>

    <!-- Player Name & Went First Row -->
    <div style="display: flex; gap: 12px; margin-bottom: 14px;">
      <div style="flex: 1;">
        <label style="display: block; font-size: 12px; font-weight: 600; color: #e5e7eb; margin-bottom: 6px;">
          Jogador:
        </label>
        <input type="text" id="modal-player-name-input" value="${match.player.name || 'Jogador'}" style="
          width: 100%;
          box-sizing: border-box;
          background: #232332;
          border: 1px solid #374151;
          border-radius: 6px;
          color: #fff;
          padding: 8px 10px;
          font-size: 13px;
        " />
      </div>
      <div style="flex: 1;">
        <label style="display: block; font-size: 12px; font-weight: 600; color: #e5e7eb; margin-bottom: 6px;">
          Iniciou a Partida?
        </label>
        <select id="modal-went-first-select" style="
          width: 100%;
          box-sizing: border-box;
          background: #232332;
          border: 1px solid #374151;
          border-radius: 6px;
          color: #fff;
          padding: 8px 10px;
          font-size: 13px;
        ">
          <option value="true" ${match.wentFirst ? 'selected' : ''}>Sim (Turno 1 meu)</option>
          <option value="false" ${match.wentFirst === false ? 'selected' : ''}>Não (Turno 1 oponente)</option>
          <option value="" ${match.wentFirst === undefined ? 'selected' : ''}>Não especificado (-)</option>
        </select>
      </div>
    </div>

    <!-- Average Turn Values Row (Editable) -->
    <div style="display: flex; gap: 12px; margin-bottom: 14px;">
      <div style="flex: 1;">
        <label style="display: block; font-size: 12px; font-weight: 600; color: #6ee7b7; margin-bottom: 6px;">
          Meu Valor Médio/Turno:
        </label>
        <input type="text" id="modal-player-avg-input" value="${match.player.avgTurnValue !== undefined ? formatDecimal(match.player.avgTurnValue) : ''}" placeholder="Ex: 14,8" style="
          width: 100%;
          box-sizing: border-box;
          background: #232332;
          border: 1px solid #374151;
          border-radius: 6px;
          color: #6ee7b7;
          font-weight: 600;
          padding: 8px 10px;
          font-size: 13px;
        " />
      </div>
      <div style="flex: 1;">
        <label style="display: block; font-size: 12px; font-weight: 600; color: #fca5a5; margin-bottom: 6px;">
          Valor Médio/Turno Oponente:
        </label>
        <input type="text" id="modal-opp-avg-input" value="${match.opponent.avgTurnValue !== undefined ? formatDecimal(match.opponent.avgTurnValue) : ''}" placeholder="Ex: 11,33" style="
          width: 100%;
          box-sizing: border-box;
          background: #232332;
          border: 1px solid #374151;
          border-radius: 6px;
          color: #fca5a5;
          font-weight: 600;
          padding: 8px 10px;
          font-size: 13px;
        " />
      </div>
    </div>

    <!-- Match Notes Field -->
    <div style="margin-bottom: 14px;">
      <label style="display: block; font-size: 12px; font-weight: 600; color: #e5e7eb; margin-bottom: 6px;">
        Notas da Partida (observações, erros, aprendizados):
      </label>
      <textarea id="modal-notes-textarea" rows="3" placeholder="Ex: Oponente utilizou combo agressivo no turno 3. Priorizar bloqueios com equipamento..." style="
        width: 100%;
        box-sizing: border-box;
        background: #232332;
        border: 1px solid #374151;
        border-radius: 6px;
        color: #fff;
        padding: 10px;
        font-size: 13px;
        font-family: inherit;
        resize: vertical;
      ">${match.notes || ''}</textarea>
    </div>

    <!-- Sideboard / Excluded Cards Field -->
    <div style="margin-bottom: 20px;">
      <label style="display: block; font-size: 12px; font-weight: 600; color: #e5e7eb; margin-bottom: 6px;">
        Cartas Fora do Deck / Sideboard (separadas por vírgula):
      </label>
      <input type="text" id="modal-sideboard-input" value="${(match.sideboardCards || []).join(', ')}" style="
        width: 100%;
        box-sizing: border-box;
        background: #232332;
        border: 1px solid #374151;
        border-radius: 6px;
        color: #fff;
        padding: 8px 10px;
        font-size: 13px;
      " />
      <span style="font-size: 11px; color: #9ca3af; display: block; margin-top: 4px;">
        Identificado automaticamente durante o setup. Ajuste se necessário caso o main deck tenha menos de 60 cartas.
      </span>
    </div>

    <!-- Status toast area -->
    <div id="modal-status" style="min-height: 18px; margin-bottom: 14px; font-size: 12px; text-align: center;"></div>

    <!-- Action Buttons -->
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <button id="modal-btn-sheets" style="
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 11px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      ">
        📊 Salvar no Google Sheets
      </button>

      ${(spreadsheetUrl || webhookUrl) ? `
      <button id="modal-btn-open-sheet" type="button" style="
        background: #1e293b;
        color: #38bdf8;
        border: 1px solid #0284c7;
        border-radius: 6px;
        padding: 9px;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      ">
        🌐 Abrir Planilha Google
      </button>
      ` : ''}

      <div style="display: flex; gap: 8px;">
        <button id="modal-btn-csv" style="
          flex: 1;
          background: #2f3442;
          color: #f3f4f6;
          border: 1px solid #4b5563;
          border-radius: 6px;
          padding: 9px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        ">
          📥 Baixar CSV (Excel PT-BR)
        </button>
        <button id="modal-btn-log" style="
          flex: 1;
          background: #2f3442;
          color: #f3f4f6;
          border: 1px solid #4b5563;
          border-radius: 6px;
          padding: 9px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        ">
          📄 Baixar Log Completo (.txt)
        </button>
      </div>

      <button id="modal-btn-cancel" style="
        background: transparent;
        color: #9ca3af;
        border: none;
        padding: 6px;
        font-size: 12px;
        cursor: pointer;
        margin-top: 4px;
      ">
        Fechar
      </button>
    </div>
  `;

  overlay.appendChild(container);

  let opponentAvgVal = match.opponent.avgTurnValue;

  const updateOpponentAvg = (newVal?: number) => {
    if (newVal !== undefined && newVal !== null && !isNaN(newVal)) {
      opponentAvgVal = newVal;
      match.opponent.avgTurnValue = newVal;
      const oppValueEl = container.querySelector('#modal-opp-value');
      if (oppValueEl) oppValueEl.textContent = formatDecimal(newVal);
      const oppInputEl = container.querySelector<HTMLInputElement>('#modal-opp-avg-input');
      if (oppInputEl) oppInputEl.value = formatDecimal(newVal);
      const alertEl = container.querySelector<HTMLElement>('#modal-opp-alert');
      const alertTextEl = container.querySelector<HTMLElement>('#modal-opp-alert-text');
      if (alertEl) {
        alertEl.style.background = 'rgba(16, 185, 129, 0.15)';
        alertEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        alertEl.style.color = '#6ee7b7';
      }
      if (alertTextEl) {
        alertTextEl.innerHTML = `✅ Valor Médio do Oponente capturado (${formatDecimal(newVal)})`;
      }
    }
  };

  (overlay as any).updateOpponentAvg = updateOpponentAvg;

  // Minimize button listener
  container.querySelector('#modal-minimize-btn')?.addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  // Switch opponent tab button listener
  container.querySelector('#modal-switch-opp-tab-btn')?.addEventListener('click', () => {
    const oppTab = findOpponentTabElement(document, match.opponent?.name || match.opponent?.hero);
    if (oppTab) {
      oppTab.click();
    }
    const checkAttempts = [50, 150, 300, 500];
    checkAttempts.forEach((delay) => {
      setTimeout(() => {
        if (onRefreshStats) {
          const stats = onRefreshStats();
          if (stats?.opponentAvgTurnValue !== undefined) {
            updateOpponentAvg(stats.opponentAvgTurnValue);
            setStatus('Valor do oponente capturado com sucesso! ✅');
          }
        }
      }, delay);
    });
  });

  container.querySelector('#modal-refresh-stats-btn')?.addEventListener('click', () => {
    if (onRefreshStats) {
      const stats = onRefreshStats();
      if (stats?.opponentAvgTurnValue !== undefined) {
        updateOpponentAvg(stats.opponentAvgTurnValue);
        setStatus('Estatísticas atualizadas! ✅');
      } else {
        setStatus('Nenhum valor novo detectado. Você pode digitar diretamente no campo Valor Médio Oponente.', true);
      }
    }
  });

  // Open Google Sheets button
  container.querySelector('#modal-btn-open-sheet')?.addEventListener('click', () => {
    const targetUrl = spreadsheetUrl || webhookUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    }
  });

  // Helper to read latest values
  const getUpdatedMatch = (): MatchRecord => {
    const playerEl = container.querySelector<HTMLInputElement>('#modal-player-name-input');
    const wentFirstEl = container.querySelector<HTMLSelectElement>('#modal-went-first-select');
    const notesEl = container.querySelector<HTMLTextAreaElement>('#modal-notes-textarea');
    const sideboardEl = container.querySelector<HTMLInputElement>('#modal-sideboard-input');
    const playerAvgInput = container.querySelector<HTMLInputElement>('#modal-player-avg-input')?.value.trim();
    const oppAvgInput = container.querySelector<HTMLInputElement>('#modal-opp-avg-input')?.value.trim();

    const parseNum = (s?: string): number | undefined => {
      if (!s || s === '-') return undefined;
      const n = parseFloat(s.replace(',', '.'));
      return isNaN(n) ? undefined : n;
    };

    const updatedPlayerName = playerEl?.value.trim() || match.player.name || 'Jogador';
    const wentFirstVal = wentFirstEl?.value;
    const updatedWentFirst = wentFirstVal === 'true' ? true : wentFirstVal === 'false' ? false : undefined;
    const updatedNotes = notesEl?.value.trim() || '';
    const updatedSideboard = sideboardEl?.value
      ? sideboardEl.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const finalPlayerAvg = parseNum(playerAvgInput) ?? match.player.avgTurnValue;
    const finalOppAvg = parseNum(oppAvgInput) ?? opponentAvgVal;

    return {
      ...match,
      player: {
        ...match.player,
        name: updatedPlayerName,
        avgTurnValue: finalPlayerAvg,
      },
      opponent: {
        ...match.opponent,
        avgTurnValue: finalOppAvg,
      },
      wentFirst: updatedWentFirst,
      notes: updatedNotes,
      sideboardCards: updatedSideboard,
    };
  };

  const statusEl = container.querySelector<HTMLDivElement>('#modal-status');
  const setStatus = (msg: string, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#f87171' : '#34d399';
  };

  // Google Sheets button
  const sheetsBtn = container.querySelector<HTMLButtonElement>('#modal-btn-sheets');
  sheetsBtn?.addEventListener('click', async () => {
    const updated = getUpdatedMatch();
    setStatus('Enviando para Google Sheets...');
    if (sheetsBtn) sheetsBtn.disabled = true;

    try {
      const res = await onSaveToSheets(updated);
      if (res.success) {
        setStatus('Partida salva no Google Sheets com sucesso! ✅');
      } else {
        setStatus(`Erro: ${res.error || 'Falha ao salvar'} ❌`, true);
      }
    } catch (err: any) {
      setStatus(`Erro: ${err?.message || 'Falha inesperada'} ❌`, true);
    } finally {
      if (sheetsBtn) sheetsBtn.disabled = false;
    }
  });

  // Local CSV button
  const csvBtn = container.querySelector<HTMLButtonElement>('#modal-btn-csv');
  csvBtn?.addEventListener('click', () => {
    const updated = getUpdatedMatch();
    const csvData = formatMatchSummaryCsv(updated);
    const filename = `talishar-${updated.id}.csv`;
    downloadFile(csvData, filename, 'text/csv');
    setStatus('Arquivo CSV baixado com sucesso! ✅');
  });

  // Full Log button
  const logBtn = container.querySelector<HTMLButtonElement>('#modal-btn-log');
  logBtn?.addEventListener('click', () => {
    const updated = getUpdatedMatch();
    const logData = formatFullLogText(updated);
    const filename = `talishar-${updated.id}-log.txt`;
    downloadFile(logData, filename, 'text/plain');
    setStatus('Log completo baixado com sucesso! ✅');
  });

  // Close actions
  const close = () => {
    overlay.remove();
    onClose();
  };

  container.querySelector('#modal-close-icon')?.addEventListener('click', close);
  container.querySelector('#modal-btn-cancel')?.addEventListener('click', close);

  // Dragging logic
  const dragHeader = container.querySelector<HTMLDivElement>('#modal-drag-header');
  if (dragHeader) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    dragHeader.addEventListener('mousedown', (e: MouseEvent) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = container.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      container.style.transform = 'none';
      container.style.left = `${startLeft}px`;
      container.style.top = `${startTop}px`;
      
      dragHeader.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      container.style.left = `${startLeft + dx}px`;
      container.style.top = `${startTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        dragHeader.style.cursor = 'grab';
      }
    });
  }

  overlay.appendChild(container);
  return overlay;
}
