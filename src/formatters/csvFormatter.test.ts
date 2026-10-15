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
      '"Dia";"Jogador";"Deck";"Match";"Formato";"Resultado";"Iniciou";"Plataforma de Jogo";"Adversário";"Observações";"Turnos";"Meu Valor Médio/Turno";"Valor Médio/Turno Oponente";"Cartas Fora/Sideboard"'
    );

    // Values check
    const row = lines[1];
    expect(row).toContain('"Renan"');
    expect(row).toContain('"Kayo, Armed and Dangerous"');
    expect(row).toContain('"Dorinthea Ironsong"'); // Match column now contains opponent hero
    expect(row).toContain('"CC"');
    expect(row).toContain('"Vitória"');
    expect(row).toContain('"Talishar"');
    expect(row).toContain('"RivalPlayer"');
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
    expect(lines[2]).toContain('"Derrota"');
    expect(lines[2]).toContain('"9,0"');
    expect(lines[2]).toContain('"-"'); // Empty sideboard represented cleanly
  });

  it('should format full text log replacing player usernames with hero names for AI analysis', () => {
    const fullLog = formatFullLogText(sampleMatch);

    expect(fullLog).toContain('=== PARTIDA TALISHAR: Kayo, Armed and Dangerous vs Dorinthea Ironsong ===');
    expect(fullLog).toContain('Resultado: Vitória');
    expect(fullLog).toContain('Meu Valor Médio/Turno: 14,5');
    expect(fullLog).toContain('Valor Médio/Turno Oponente: 11,25');
    expect(fullLog).toContain('Sideboard / Cartas Fora: Pummel (Red), Cast Bones');
    expect(fullLog).toContain('Notas: Ótima partida!');
    expect(fullLog).toContain('--- LOG DE COMBATE COMPLETO (PERSONAGENS / IA) ---');
    // Player usernames replaced by heroes for AI readability
    expect(fullLog).toContain('Turn 1: Kayo, Armed and Dangerous pitched Wild Ride');
    expect(fullLog).toContain('Turn 1: Dorinthea Ironsong blocked with Ironrot Gauntlet');
    expect(fullLog).toContain('Turn 7: Kayo, Armed and Dangerous attacks for lethal');
  });

  it('should enrich chain links with attack card, pitch notation, and damage value', () => {
    const chainMatch: MatchRecord = {
      ...sampleMatch,
      player: { name: 'akiles185', hero: 'Ser Boltyn, Breaker of Dawn' },
      opponent: { name: 'PlayerTwo', hero: 'Levia, Shadowborn Abomination' },
      sideboardCards: ['Beaming Bravado (y)', 'Dread Screamer (r)'],
      rawLogs: [
        '--- Turn 1 ---',
        'Chain Link 1',
        'akiles185 played Beaming Bravado',
        'PlayerTwo is about to take 6 damage from Beaming Bravado',
        'PlayerTwo took 6 damage',
        'Chain Link 2',
        'akiles185 played Raydn, Duskbane',
        'PlayerTwo blocked for 3',
        'The combat chain was closed',
      ],
    };

    const fullLog = formatFullLogText(chainMatch);
    expect(fullLog).toContain('[Chain Link 1] Beaming Bravado (y) (Poder: 6) — 6 de dano');
    expect(fullLog).toContain('[Chain Link 2] Raydn, Duskbane (Poder: 3) — 0 de dano (bloqueado por 3)');
  });

  it('should infer player hero from combat log targets and export it into CSV Deck column instead of dash', () => {
    const matchWithMissingHero: MatchRecord = {
      ...sampleMatch,
      player: { name: 'akiles185', hero: '-' },
      opponent: { name: 'TheLegend27', hero: 'Vynnset Iron Maiden' },
      rawLogs: [
        '--- Turn 1 - akiles185 ---',
        'Chain Link 1',
        'akiles185 played Bolt of Courage (y)',
        '🎯Vynnset, Iron Maiden was chosen as the target.',
        '--- Turn 1 - Vynnset Iron Maiden ---',
        'Chain Link 1',
        'Vynnset Iron Maiden played Widespread Annihilation',
        '🎯Ser Boltyn, Breaker of Dawn was chosen as the target.',
        'akiles185 blocked with Longsword Leggings',
        'akiles185 is about to take 5 damage from Widespread Annihilation',
        'akiles185 took 5 damage',
        'The combat chain was closed.',
      ],
    };

    const csv = formatMatchSummaryCsv(matchWithMissingHero);
    expect(csv).toContain(';"Ser Boltyn, Breaker of Dawn";');
    expect(csv).not.toContain(';"-";"Vynnset');

    const fullLog = formatFullLogText(matchWithMissingHero);
    expect(fullLog).toContain('Jogador: akiles185 (Ser Boltyn, Breaker of Dawn)');
    expect(fullLog).toContain('Widespread Annihilation (r)');
    expect(fullLog).toContain('(Poder: 6) — 5 de dano (1 bloqueado)');
  });

  it('should correctly format Kiss of Death attack with live power, avoid non-attack chain links and not split on Flick Knives', () => {
    const kissMatch: MatchRecord = {
      ...sampleMatch,
      player: { name: 'akiles185', hero: 'Arakni, Marionette' },
      opponent: { name: 'Vandernesh', hero: 'Viserai, the Forsaken' },
      activeChainLinks: [
        { card: 'Kiss of Death', power: 16, defense: 15, turn: 1 },
      ],
      rawLogs: [
        '--- Turn 1 - Arakni Marionette ---',
        'Resolving play ability of Cut from the Same Cloth (r).',
        '👁️‍🗨️Open the Gate to i\'Arathael (r), Deadwood Dirge (r), Murmuring Gloomblade (r), Shadowrealm Walker (r) are revealed',
        'Resolving play ability of Savor Bloodshed (r).',
        'Resolving play ability of Savor Bloodshed (r).',
        '🎯Viserai, the Forsaken was chosen as the target.',
        'Resolving play ability of Kiss of Death (r).',
        'Viserai The Forsaken passed',
        'Viserai The Forsaken blocked with Face Purgatory, Grasp of the Arknight, Open the Gate to i\'Arathael (r), Deadwood Dirge (r), Murmuring Gloomblade (r), and Shadowrealm Walker (r)',
        'Arakni Marionette\'s Hunter\'s Klaive was targeted',
        'Viserai The Forsaken\'s Viserai, the Forsaken was targeted',
        'Resolving activated ability of Flick Knives.',
        'Viserai The Forsaken is about to take 1 damage from Hunter\'s Klaive',
        'Viserai The Forsaken took 1 damage',
        'Processing hit effect for Hunter\'s Klaive',
        '🎯Viserai The Forsaken is now marked!',
        'Arakni Marionette passed (x2)',
        'Viserai The Forsaken is about to take 1 damage from Kiss of Death (r)',
        'Viserai The Forsaken took 1 damage',
        'Combat resolved with a hit for 1 damage',
        'Viserai The Forsaken loses their mark',
        'Processing hit effect for Kiss of Death (r)',
        'Viserai The Forsaken loses 1 life.',
        'The chain link was resolved.',
        'Arakni Marionette passed',
        'The combat chain was closed.',
        'Resolving play ability of Cull (r).',
        'Pull from Beyond (b) was banished.',
        'Persuasive Prognosis (b) was banished.',
        'Resolving play ability of Orb-Weaver Spinneret (r).',
        'Arakni Marionette passed (x2)',
      ],
    };

    const fullLog = formatFullLogText(kissMatch);

    // Should NOT have chain links for non-attacks
    expect(fullLog).not.toContain('[Chain Link 1] Cut from the Same Cloth');
    expect(fullLog).not.toContain('[Chain Link 2] Savor Bloodshed');
    expect(fullLog).not.toContain('[Chain Link 2] Kiss of Death');
    expect(fullLog).not.toContain('[Chain Link 3]');
    expect(fullLog).not.toContain('[Chain Link 4]');

    // Should have Kiss of Death as Chain Link 1 with power 16 and defense
    expect(fullLog).toContain('[Chain Link 1] Kiss of Death (r) (Poder: 16) — 1 de dano (15 bloqueado)');

    // Should NOT have empty [Chain Link] lines
    expect(fullLog).not.toMatch(/^\[Chain Link \d+\]\s*$/m);
  });
});
