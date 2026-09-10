import type { MatchRecord } from '../types/match';
import { formatMatchSummaryCsv, formatFullLogText } from '../formatters/csvFormatter';
import type { SheetsResponse } from '../services/sheetsClient';

export interface ModalOptions {
  match: MatchRecord;
  webhookUrl?: string;
  onSaveToSheets: (match: MatchRecord) => Promise<SheetsResponse>;
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
  const { match, webhookUrl, onSaveToSheets, onClose } = options;

  const overlay = document.createElement('div');
  overlay.id = 'talishar-export-modal';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 10, 15, 0.82);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
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
    width: 520px;
    max-width: 92vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    color: #f3f4f6;
    padding: 24px;
    box-sizing: border-box;
  `;

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; font-size: 18px; color: #ff7043; display: flex; align-items: center; gap: 8px;">
        ⚔️ Salvar e Exportar Partida
      </h2>
      <button id="modal-close-icon" style="background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; line-height: 1;">&times;</button>
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
        <div>Oponente: <strong style="color: #fca5a5;">${formatDecimal(match.opponent.avgTurnValue)}</strong></div>
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

  // Helper to read latest values
  const getUpdatedMatch = (): MatchRecord => {
    const notesEl = container.querySelector<HTMLTextAreaElement>('#modal-notes-textarea');
    const sideboardEl = container.querySelector<HTMLInputElement>('#modal-sideboard-input');
    const updatedNotes = notesEl?.value.trim() || '';
    const updatedSideboard = sideboardEl?.value
      ? sideboardEl.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    return {
      ...match,
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

  return overlay;
}
