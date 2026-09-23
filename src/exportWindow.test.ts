import { describe, it, expect, vi } from 'vitest';
import type { MatchRecord } from './types/match';
import { formatMatchSummaryCsv, formatFullLogText } from './formatters/csvFormatter';

describe('Export Window Data Model & Formatting', () => {
  const sampleMatch: MatchRecord = {
    id: 'talishar-1727123456789',
    timestamp: '2026-09-23T21:00:00.000Z',
    player: {
      name: 'Renan',
      hero: 'Kayo, Armed and Dangerous',
      avgTurnValue: 14.8,
    },
    opponent: {
      name: 'Adversary',
      hero: 'Dorinthea Ironsong',
      avgTurnValue: 11.2,
    },
    result: 'win',
    turnsCount: 6,
    sideboardCards: ['Pummel (Red)', 'Sink Below (Red)'],
    notes: 'Boa partida, foquei em bloquear os turnos chave.',
    rawLogs: ['Turn 1: Setup', 'Turn 6: Game Over'],
    format: 'CC',
    wentFirst: true,
    platform: 'Talishar',
  };

  it('correctly produces PT-BR formatted CSV summary for export', () => {
    const csv = formatMatchSummaryCsv(sampleMatch);
    expect(csv).toContain('Renan');
    expect(csv).toContain('Kayo, Armed and Dangerous');
    expect(csv).toContain('Dorinthea Ironsong');
    expect(csv).toContain('Vitória');
    expect(csv).toContain('Sim');
    expect(csv).toContain('14,8');
    expect(csv).toContain('11,2');
    expect(csv).toContain('Pummel (Red), Sink Below (Red)');
  });

  it('correctly produces full text log with raw combat log entries', () => {
    const log = formatFullLogText(sampleMatch);
    expect(log).toContain('PARTIDA TALISHAR');
    expect(log).toContain('LOG DE COMBATE COMPLETO');
    expect(log).toContain('Turn 1: Setup');
    expect(log).toContain('Turn 6: Game Over');
  });

  it('handles editing match values including decimal conversions and sideboard parsing', () => {
    const parseDecimal = (s?: string) => {
      if (!s || s === '-') return undefined;
      const n = parseFloat(s.replace(',', '.'));
      return isNaN(n) ? undefined : n;
    };

    const inputSideboardStr = 'Cast Bones, Command and Conquer';
    const parsedSideboard = inputSideboardStr.split(',').map((s) => s.trim()).filter(Boolean);

    const updatedMatch: MatchRecord = {
      ...sampleMatch,
      player: {
        ...sampleMatch.player,
        name: 'Renan Novo Nick',
        avgTurnValue: parseDecimal('15,5'),
      },
      opponent: {
        ...sampleMatch.opponent,
        avgTurnValue: parseDecimal('10,0'),
      },
      wentFirst: false,
      notes: 'Notas atualizadas',
      sideboardCards: parsedSideboard,
    };

    expect(updatedMatch.player.name).toBe('Renan Novo Nick');
    expect(updatedMatch.player.avgTurnValue).toBe(15.5);
    expect(updatedMatch.opponent.avgTurnValue).toBe(10.0);
    expect(updatedMatch.wentFirst).toBe(false);
    expect(updatedMatch.notes).toBe('Notas atualizadas');
    expect(updatedMatch.sideboardCards).toEqual(['Cast Bones', 'Command and Conquer']);
  });
});
