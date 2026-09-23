import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MatchRecord } from '../types/match';

const store = new Map<string, any>();

vi.mock('wxt/storage', () => ({
  storage: {
    getItem: vi.fn(async (key: string) => store.get(key) || null),
    setItem: vi.fn(async (key: string, value: any) => {
      store.set(key, value);
    }),
  },
}));

import {
  saveMatchToHistory,
  getMatchHistory,
  getLatestMatch,
  importMatchesFromCsv,
} from './storage';

describe('storage utils', () => {
  beforeEach(() => {
    store.clear();
  });

  const matchA: MatchRecord = {
    id: 'match-1',
    timestamp: '2026-09-01T10:00:00.000Z',
    player: { name: 'Player1', hero: 'Kayo' },
    opponent: { name: 'Opponent1', hero: 'Dorinthea' },
    result: 'win',
    turnsCount: 5,
    sideboardCards: [],
    notes: 'Game 1',
    rawLogs: [],
  };

  const matchB: MatchRecord = {
    id: 'match-2',
    timestamp: '2026-09-02T10:00:00.000Z',
    player: { name: 'Player1', hero: 'Kayo' },
    opponent: { name: 'Opponent2', hero: 'Bravo' },
    result: 'loss',
    turnsCount: 8,
    sideboardCards: [],
    notes: 'Game 2',
    rawLogs: [],
  };

  it('should save matches in chronological order with newest appended at the bottom', async () => {
    await saveMatchToHistory(matchA);
    await saveMatchToHistory(matchB);

    const history = await getMatchHistory();
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe('match-1');
    expect(history[1].id).toBe('match-2');

    const latest = await getLatestMatch();
    expect(latest?.id).toBe('match-2');
  });

  it('should import CSV matches preserving row order and appending them chronologically', async () => {
    const csvContent = [
      '"Dia";"Jogador";"Deck";"Match";"Formato";"Resultado";"Iniciou";"Plataforma de Jogo";"Adversário";"Observações";"Turnos";"Meu Valor Médio/Turno";"Valor Médio/Turno Oponente";"Cartas Fora/Sideboard"',
      '"01/09/2026";"Player1";"Kayo";"Dorinthea";"CC";"Vitória";"Sim";"Talishar";"Opp1";"Primeira linha";"5";"12,0";"10,0";"-"',
      '"02/09/2026";"Player1";"Kayo";"Bravo";"CC";"Derrota";"Não";"Talishar";"Opp2";"Segunda linha";"8";"11,5";"13,0";"-"',
    ].join('\n');

    const imported = await importMatchesFromCsv(csvContent);
    expect(imported).toBe(2);

    const history = await getMatchHistory();
    expect(history).toHaveLength(2);
    // Older match on row 1 of data
    expect(history[0].player.hero).toBe('Kayo');
    expect(history[0].opponent.hero).toBe('Dorinthea');
    // Newer match appended below on row 2 of data
    expect(history[1].player.hero).toBe('Kayo');
    expect(history[1].opponent.hero).toBe('Bravo');

    // Now play and save a new match
    const matchC: MatchRecord = {
      id: 'match-3',
      timestamp: '2026-09-03T10:00:00.000Z',
      player: { name: 'Player1', hero: 'Kayo' },
      opponent: { name: 'Opponent3', hero: 'Zen' },
      result: 'win',
      turnsCount: 6,
      sideboardCards: [],
      notes: 'Game 3',
      rawLogs: [],
    };
    await saveMatchToHistory(matchC);

    const updatedHistory = await getMatchHistory();
    expect(updatedHistory).toHaveLength(3);
    // Appended at the bottom
    expect(updatedHistory[2].id).toBe('match-3');
    expect(updatedHistory[2].opponent.hero).toBe('Zen');
  });
});
