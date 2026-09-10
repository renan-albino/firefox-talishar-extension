import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExportModal, downloadFile } from './exportModal';
import type { MatchRecord } from '../types/match';

describe('exportModal UI', () => {
  const sampleMatch: MatchRecord = {
    id: 'match-999',
    timestamp: '2026-09-09T22:00:00.000Z',
    player: { name: 'Renan', hero: 'Kayo', avgTurnValue: 14.5 },
    opponent: { name: 'Rival', hero: 'Dorinthea', avgTurnValue: 11.2 },
    result: 'win',
    turnsCount: 6,
    sideboardCards: ['Pummel (Red)', 'Cast Bones'],
    notes: '',
    rawLogs: ['Turn 1: Started', 'Turn 6: Finished'],
  };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render the modal with pre-filled match details', () => {
    const modalElement = createExportModal({
      match: sampleMatch,
      webhookUrl: 'https://script.google.com/macros/s/xyz/exec',
      onSaveToSheets: vi.fn(),
      onClose: vi.fn(),
    });

    document.body.appendChild(modalElement);

    expect(document.querySelector('#talishar-export-modal')).not.toBeNull();
    expect(document.body.innerHTML).toContain('Kayo');
    expect(document.body.innerHTML).toContain('Dorinthea');
    expect(document.body.innerHTML).toContain('14,5');
    expect(document.body.innerHTML).toContain('11,2');

    const sideboardInput = document.querySelector<HTMLInputElement>('#modal-sideboard-input');
    expect(sideboardInput?.value).toBe('Pummel (Red), Cast Bones');
  });

  it('should update match notes and sideboard when typing', () => {
    let capturedMatch: MatchRecord | null = null;

    const modalElement = createExportModal({
      match: sampleMatch,
      webhookUrl: 'https://script.google.com/macros/s/xyz/exec',
      onSaveToSheets: (updatedMatch) => {
        capturedMatch = updatedMatch;
        return Promise.resolve({ success: true });
      },
      onClose: vi.fn(),
    });

    document.body.appendChild(modalElement);

    const notesTextarea = document.querySelector<HTMLTextAreaElement>('#modal-notes-textarea');
    const sideboardInput = document.querySelector<HTMLInputElement>('#modal-sideboard-input');
    const sheetsBtn = document.querySelector<HTMLButtonElement>('#modal-btn-sheets');

    if (notesTextarea) notesTextarea.value = 'Excelente partida, pressionei a vida desde o início.';
    if (sideboardInput) sideboardInput.value = 'Pummel (Red), Sink Below';

    sheetsBtn?.click();

    expect(capturedMatch).not.toBeNull();
    expect((capturedMatch as any).notes).toBe('Excelente partida, pressionei a vida desde o início.');
    expect((capturedMatch as any).sideboardCards).toEqual(['Pummel (Red)', 'Sink Below']);
  });

  it('should trigger browser download using downloadFile', () => {
    vi.useFakeTimers();
    const createObjectURLMock = vi.fn().mockReturnValue('blob:test-url');
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    downloadFile('test content', 'test.csv', 'text/csv');

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
    vi.useRealTimers();
  });
});
