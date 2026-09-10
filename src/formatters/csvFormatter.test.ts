import { describe, it, expect } from 'vitest';
import {
  formatMatchSummaryCsv,
  formatMatchHistoryCsv,
  formatFullLogText,
} from './csvFormatter';
import type { MatchRecord } from '../types/match';

describe('CsvFormatter (PT-BR Excel & Full Log)', () => {
  const sampleMatch: MatchRecord = {
    id: 'match-001',
    timestamp: '2026-09-09T22:00:00.000Z',
    player: {
      name: 'Renan',
      hero: 'Kayo, Armed and Dangerous',
      avgTurnValue: 14.5,
    },
    opponent: {
      name: 'RivalPlayer',
      hero: 'Dorinthea Ironsong',
      avgTurnValue: 11.25,
    },
    result: 'win',
    turnsCount: 7,
    sideboardCards: ['Pummel (Red)', 'Cast Bones'],
    notes: 'Ótima partida! Oponente tentou combo de "Dawnblade" no turno 4.',
    rawLogs: [
      'Turn 1: Renan pitched Wild Ride',
      'Turn 1: RivalPlayer blocked with Ironrot Gauntlet',
      'Turn 7: Renan attacks for lethal',
    ],
  };

  it('should format a single match CSV with UTF-8 BOM, semicolon delimiter, and escaped quotes', () => {
    const csv = formatMatchSummaryCsv(sampleMatch);

    // Should begin with UTF-8 BOM
    expect(csv.startsWith('\uFEFF')).toBe(true);

    const lines = csv.replace('\uFEFF', '').trim().split('\n');
    expect(lines).toHaveLength(2); // Header + 1 Row

    // Header check
    expect(lines[0]).toBe(
      '"ID";"Data/Hora";"Jogador";"Heroi";"Oponente";"Heroi Oponente";"Resultado";"Turnos";"Meu Valor Medio/Turno";"Valor Medio/Turno Oponente";"Cartas Fora/Sideboard";"Notas"'
    );

    // Values check
    const row = lines[1];
    expect(row).toContain('"match-001"');
    expect(row).toContain('"Renan"');
    expect(row).toContain('"Kayo, Armed and Dangerous"');
    expect(row).toContain('"RivalPlayer"');
    expect(row).toContain('"Dorinthea Ironsong"');
    expect(row).toContain('"Vitoria"');
    expect(row).toContain('"7"');
    // PT-BR decimal with comma
    expect(row).toContain('"14,5"');
    expect(row).toContain('"11,25"');
    expect(row).toContain('"Pummel (Red), Cast Bones"');
    // Escaped internal double quotes
    expect(row).toContain('"Ótima partida! Oponente tentou combo de ""Dawnblade"" no turno 4."');
  });

  it('should format multiple matches into a single history CSV', () => {
    const secondMatch: MatchRecord = {
      ...sampleMatch,
      id: 'match-002',
      result: 'loss',
      player: { ...sampleMatch.player, avgTurnValue: 9.0 },
      opponent: { ...sampleMatch.opponent, avgTurnValue: 15.0 },
      sideboardCards: [],
      notes: '',
    };

    const csv = formatMatchHistoryCsv([sampleMatch, secondMatch]);
    const lines = csv.replace('\uFEFF', '').trim().split('\n');

    expect(lines).toHaveLength(3); // Header + 2 data rows
    expect(lines[2]).toContain('"match-002"');
    expect(lines[2]).toContain('"Derrota"');
    expect(lines[2]).toContain('"9,0"');
    expect(lines[2]).toContain('"-"'); // Empty sideboard represented cleanly
  });

  it('should format full text log for human reading', () => {
    const fullLog = formatFullLogText(sampleMatch);

    expect(fullLog).toContain('=== PARTIDA TALISHAR: Kayo, Armed and Dangerous vs Dorinthea Ironsong ===');
    expect(fullLog).toContain('Resultado: Vitoria');
    expect(fullLog).toContain('Meu Valor Medio/Turno: 14,5');
    expect(fullLog).toContain('Valor Medio/Turno Oponente: 11,25');
    expect(fullLog).toContain('Sideboard / Cartas Fora: Pummel (Red), Cast Bones');
    expect(fullLog).toContain('Notas: Ótima partida!');
    expect(fullLog).toContain('--- LOG COMPLETO ---');
    expect(fullLog).toContain('Turn 1: Renan pitched Wild Ride');
    expect(fullLog).toContain('Turn 7: Renan attacks for lethal');
  });
});
