import type { MatchRecord, MatchResult } from '../types/match';

const UTF8_BOM = '\uFEFF';
const DELIMITER = ';';

export const CSV_HEADERS = [
  'Dia',
  'Jogador',
  'Deck',
  'Match',
  'Formato',
  'Resultado',
  'Iniciou',
  'Plataforma de Jogo',
  'Adversário',
  'Observações',
  'Turnos',
  'Meu Valor Médio/Turno',
  'Valor Médio/Turno Oponente',
  'Cartas Fora/Sideboard',
];

function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) {
    return '""';
  }
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatDatePtBr(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}

function formatDecimalPtBr(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '-';
  }
  // If integer or single decimal, preserve readable representation with comma
  const rounded = Number.isInteger(val) ? val.toFixed(1) : String(val);
  return rounded.replace('.', ',');
}

function translateResult(result: MatchResult): string {
  switch (result) {
    case 'win':
      return 'Vitória';
    case 'loss':
      return 'Derrota';
    case 'draw':
      return 'Empate';
    default:
      return 'Desconhecido';
  }
}

function matchToCsvRow(match: MatchRecord): string {
  const sideboardText =
    match.sideboardCards && match.sideboardCards.length > 0
      ? match.sideboardCards.join(', ')
      : '-';

  const matchTitle = match.opponent.hero || '-';
  const wentFirstText = match.wentFirst === undefined ? '-' : match.wentFirst ? 'Sim' : 'Não';
  const platformText = match.platform || 'Talishar';
  const opponentText = match.opponent.name || match.opponent.hero || 'Oponente';
  const formatText = match.format || 'CC';

  const fields = [
    escapeCsvField(formatDatePtBr(match.timestamp)),
    escapeCsvField(match.player.name || 'Jogador'),
    escapeCsvField(match.player.hero || '-'),
    escapeCsvField(matchTitle),
    escapeCsvField(formatText),
    escapeCsvField(translateResult(match.result)),
    escapeCsvField(wentFirstText),
    escapeCsvField(platformText),
    escapeCsvField(opponentText),
    escapeCsvField(match.notes || ''),
    escapeCsvField(match.turnsCount ?? 0),
    escapeCsvField(formatDecimalPtBr(match.player.avgTurnValue)),
    escapeCsvField(formatDecimalPtBr(match.opponent.avgTurnValue)),
    escapeCsvField(sideboardText),
  ];

  return fields.join(DELIMITER);
}

/**
 * Substitui os nomes de tela dos jogadores pelos nomes dos seus respectivos heróis/personagens
 * para facilitar a leitura e análise por Inteligência Artificial (LLMs).
 */
export function replacePlayerNamesWithHeroes(
  logLines: string[],
  player?: { name?: string; username?: string; hero?: string },
  opponent?: { name?: string; username?: string; hero?: string }
): string[] {
  if (!logLines || logLines.length === 0) return [];

  const replacements: Array<{ alias: string; hero: string }> = [];

  const pHero = player?.hero?.trim();
  const oHero = opponent?.hero?.trim();

  const isGeneric = (name?: string) => {
    if (!name) return true;
    const lower = name.toLowerCase().trim();
    return (
      lower === 'jogador' ||
      lower === 'oponente' ||
      lower === '-' ||
      lower === 'player' ||
      lower === 'opponent' ||
      lower === 'setup' ||
      lower === 'game' ||
      lower === 'game over' ||
      lower === 'start' ||
      lower === 'end' ||
      lower === 'combat' ||
      lower === 'turn' ||
      lower.length < 2
    );
  };

  const addAlias = (alias: string | undefined, hero: string | undefined) => {
    if (!alias || !hero || hero === '-' || isGeneric(alias)) return;
    const cleanAlias = alias.trim();
    if (cleanAlias.toLowerCase() === hero.toLowerCase()) return;
    if (!replacements.some((r) => r.alias.toLowerCase() === cleanAlias.toLowerCase())) {
      replacements.push({ alias: cleanAlias, hero });
    }
  };

  // 1. Add direct names and usernames
  addAlias(player?.name, pHero);
  addAlias(player?.username, pHero);
  addAlias(opponent?.name, oHero);
  addAlias(opponent?.username, oHero);

  // 2. Discover in-game usernames from Turn Dividers (e.g. "Turn 1 - akiles185")
  const turnDividerUsers: string[] = [];
  for (const line of logLines) {
    const dividerMatch = line.match(/Turn\s+\d+\s*-\s*([A-Za-z0-9_\-.]+)/i);
    if (dividerMatch && dividerMatch[1]) {
      const user = dividerMatch[1].trim();
      if (!isGeneric(user) && !turnDividerUsers.includes(user)) {
        turnDividerUsers.push(user);
      }
    }
  }

  // If we found turn divider usernames, map them to player/opponent heroes
  if (turnDividerUsers.length >= 1) {
    const firstUser = turnDividerUsers[0];
    // If first user matches player or we know player went first
    if (player?.username && firstUser.toLowerCase() === player.username.toLowerCase()) {
      addAlias(firstUser, pHero);
      if (turnDividerUsers.length >= 2) addAlias(turnDividerUsers[1], oHero);
    } else if (opponent?.username && firstUser.toLowerCase() === opponent.username.toLowerCase()) {
      addAlias(firstUser, oHero);
      if (turnDividerUsers.length >= 2) addAlias(turnDividerUsers[1], pHero);
    } else {
      // First actor is player if unassigned
      addAlias(firstUser, pHero);
      if (turnDividerUsers.length >= 2) addAlias(turnDividerUsers[1], oHero);
    }
  }

  if (replacements.length === 0) return logLines;

  // Sort longest aliases first to avoid partial replacements
  replacements.sort((a, b) => b.alias.length - a.alias.length);

  return logLines.map((line) => {
    let modified = line;
    for (const { alias, hero } of replacements) {
      // Handle possessive first: e.g. "akiles185's" -> "Kayo's"
      const possessiveRegex = new RegExp(`\\b${escapeRegex(alias)}'s\\b`, 'gi');
      modified = modified.replace(possessiveRegex, `${hero}'s`);

      // Handle standard word boundary match: "akiles185" -> "Kayo"
      const boundaryStart = /^\w/.test(alias) ? '\\b' : '';
      const boundaryEnd = /\w$/.test(alias) ? '\\b' : '';
      const regex = new RegExp(`${boundaryStart}${escapeRegex(alias)}${boundaryEnd}`, 'gi');
      modified = modified.replace(regex, hero);
    }
    return modified;
  });
}

/**
 * Formats a single match into a standalone PT-BR CSV with headers and UTF-8 BOM.
 */
export function formatMatchSummaryCsv(match: MatchRecord): string {
  const headerRow = CSV_HEADERS.map((h) => `"${h}"`).join(DELIMITER);
  const dataRow = matchToCsvRow(match);
  return `${UTF8_BOM}${headerRow}\n${dataRow}\n`;
}

/**
 * Formats an array of matches into a consolidated history CSV with headers and UTF-8 BOM.
 */
export function formatMatchHistoryCsv(matches: MatchRecord[]): string {
  const headerRow = CSV_HEADERS.map((h) => `"${h}"`).join(DELIMITER);
  const dataRows = matches.map((m) => matchToCsvRow(m)).join('\n');
  return `${UTF8_BOM}${headerRow}\n${dataRows}\n`;
}

export const KNOWN_FAB_PITCHES: Record<string, 'r' | 'y' | 'b'> = {
  // Light / Warrior
  'lumina ascension': 'y',
  'spirit of eirina': 'y',
  'beacon of victory': 'y',
  'soul shield': 'y',
  'saving grace': 'y',
  'spirit of war': 'r',
  'v of the vanguard': 'y',
  'battlefield beacon': 'y',
  'bravery of the blade': 'r',
  'banneret of swordsmanship': 'y',
  'banneret of courage': 'y',
  'banneret of resilience': 'y',
  'banneret of gallantry': 'y',
  'blessing of bellona': 'y',
  'blessing of suraya': 'y',
  'blessing of aegis': 'y',
  'blessing of themis': 'y',
  'prayer of bellona': 'y',
  'duty bound blitz': 'r',
  'beaming bravado': 'y',
  'celestial cataclysm': 'y',
  'tenacity': 'y',

  // Shadow / Brute / Levia
  'cleave the heavens': 'r',
  'engulfing shadows': 'r',
  'feasting shadowbeast': 'r',
  'dread screamer': 'r',
  'endless maw': 'r',
  'shadowrealm horror': 'r',
  'deadwood rumbler': 'r',
  'bloodrush bellow': 'y',
  'blood harvest': 'r',
  'diabolic offering': 'r',
  'pull from beyond': 'b',
  'vigorous smashup': 'b',
  'goremass summoning': 'b',
  'rockyard rodeo': 'y',
  'consuming strength': 'r',
  'corrupt and conquer': 'r',
  'fallen herald': 'y',
  'wrecker romp': 'r',
  'feeding frenzy': 'r',

  // Generic staples
  'command and conquer': 'r',
  'enlightened strike': 'r',
  'sink below': 'r',
  'fate foreseen': 'r',
  'sigil of solace': 'r',
  'pummel': 'r',
  'art of war': 'y',
  'energy potion': 'b',
  'potion of strength': 'b',
  'warmongers diplomacy': 'b',
  'that all you got': 'y',
  'give and take': 'y',
  'codex of frailty': 'y',
  'codex of bloodrot': 'y',
  'codex of inertia': 'y',
  'shake down': 'r',
  'swarming gloomveil': 'r',
  'preach': 'r',
};

/**
 * Builds a pitch lookup map from match metadata, sideboard, and logs.
 */
export function buildKnownPitchMap(match: MatchRecord): Map<string, 'r' | 'y' | 'b'> {
  const pitchMap = new Map<string, 'r' | 'y' | 'b'>();

  // 1. Preload defaults
  for (const [card, pitch] of Object.entries(KNOWN_FAB_PITCHES)) {
    pitchMap.set(card.toLowerCase(), pitch);
  }

  // 2. Scan sideboard cards: "Card Name (r)"
  if (match.sideboardCards) {
    for (const item of match.sideboardCards) {
      const matchPitch = item.match(/^(.+?)\s*\(([ryb])\)$/i);
      if (matchPitch) {
        pitchMap.set(matchPitch[1].trim().toLowerCase(), matchPitch[2].toLowerCase() as 'r' | 'y' | 'b');
      }
    }
  }

  // 3. Scan raw logs for any card names formatted with (r), (y), (b)
  if (match.rawLogs) {
    for (const line of match.rawLogs) {
      const matches = line.matchAll(/([A-Z][a-zA-Z\s,'-]{2,30})\s*\(([ryb])\)/gi);
      for (const m of matches) {
        const cardName = m[1].trim().toLowerCase();
        const pitch = m[2].toLowerCase() as 'r' | 'y' | 'b';
        if (!pitchMap.has(cardName)) {
          pitchMap.set(cardName, pitch);
        }
      }
    }
  }

  return pitchMap;
}

/**
 * Decorates card references in a combat log line with pitch notations if known.
 */
export function decorateLineWithPitches(line: string, pitchMap: Map<string, 'r' | 'y' | 'b'>): string {
  if (
    line.startsWith('---') ||
    line.startsWith('===') ||
    line.startsWith('[Mão Comprada') ||
    line.startsWith('[Chain Link')
  ) {
    return line;
  }

  let modified = line;
  for (const [cardName, pitch] of pitchMap.entries()) {
    // Only match whole card names not already followed by (r), (y), or (b)
    const regex = new RegExp(`\\b${escapeRegex(cardName)}\\b(?!\\s*\\([ryb]\\))`, 'gi');
    if (regex.test(modified)) {
      modified = modified.replace(regex, (match) => `${match} (${pitch})`);
    }
  }
  return modified;
}

/**
 * Enriches Chain Link lines with the attack card and total damage/threatened value.
 */
export function enrichChainLinksWithDamage(
  lines: string[],
  pitchMap?: Map<string, 'r' | 'y' | 'b'>
): string[] {
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const chainMatch = line.match(/^(?:\[?Chain Link\s*(\d+)\]?)/i);

    if (chainMatch) {
      const linkNum = chainMatch[1];
      let attackCard = '';
      let damageValue: number | undefined;

      let hasBlock = false;

      // Look ahead up to 18 lines for the attack resolution
      for (let j = i + 1; j < Math.min(lines.length, i + 18); j++) {
        const nextLine = lines[j];
        if (
          /^(?:\[?Chain Link\s*\d+|The combat chain was closed|--- Turn)/i.test(nextLine)
        ) {
          break;
        }

        // Damage detection: "is about to take X damage from <Card>" or "took X damage"
        const dmgAboutMatch = nextLine.match(/is about to take\s*(\d+)\s*damage(?:\s+from\s*(.*))?/i);
        if (dmgAboutMatch) {
          damageValue = parseInt(dmgAboutMatch[1], 10);
          if (!attackCard && dmgAboutMatch[2]?.trim()) attackCard = dmgAboutMatch[2].trim();
        }

        const tookDmgMatch = nextLine.match(/took\s*(\d+)\s*damage/i);
        if (tookDmgMatch && damageValue === undefined) {
          damageValue = parseInt(tookDmgMatch[1], 10);
        }

        const combatHitMatch = nextLine.match(/Combat resolved with a hit for\s*(\d+)\s*damage/i);
        if (combatHitMatch && damageValue === undefined) {
          damageValue = parseInt(combatHitMatch[1], 10);
        }

        if (
          /Combat resolved with no hit/i.test(nextLine) ||
          /(?:blocked|defended)\s+(?:with|for)/i.test(nextLine)
        ) {
          hasBlock = true;
        }

        // Attack card detection if not already found
        if (!attackCard) {
          const playedMatch = nextLine.match(
            /(?:played|activated)\s+(?!ability\b|Ser Boltyn|Levia|Bravo|Kayo|Dorinthea)(.+?)(?:\s+from\s+arsenal|\s+for\s+\d+|$)/i
          );
          if (playedMatch) {
            const candidate = playedMatch[1].trim();
            if (
              !candidate.toLowerCase().includes('ability') &&
              !candidate.toLowerCase().includes('pass')
            ) {
              attackCard = candidate;
            }
          }
        }
      }

      if (damageValue === undefined && hasBlock) {
        damageValue = 0;
      }

      // Add pitch to attackCard if known
      if (attackCard && pitchMap) {
        const lower = attackCard.toLowerCase().replace(/\s*\([ryb]\)$/i, '').trim();
        if (!/\([ryb]\)/i.test(attackCard) && pitchMap.has(lower)) {
          attackCard = `${attackCard} (${pitchMap.get(lower)})`;
        }
      }

      let formattedHeader = `[Chain Link ${linkNum}]`;
      if (attackCard) {
        if (damageValue !== undefined) {
          const dmgDesc = damageValue > 0 ? `${damageValue} de dano` : '0 de dano (bloqueado)';
          formattedHeader = `[Chain Link ${linkNum}] ${attackCard} — ${dmgDesc}`;
        } else {
          formattedHeader = `[Chain Link ${linkNum}] ${attackCard}`;
        }
      }

      result.push(formattedHeader);
    } else {
      result.push(line);
    }
  }

  return result;
}

/**
 * Formats a human-readable complete match log including metadata and turn history.
 */
export function formatFullLogText(match: MatchRecord): string {
  const sideboardText =
    match.sideboardCards && match.sideboardCards.length > 0
      ? match.sideboardCards.join(', ')
      : '-';

  const playerEquipText =
    match.playerEquipment && match.playerEquipment.length > 0
      ? match.playerEquipment.join(', ')
      : '-';

  const oppEquipText =
    match.opponentEquipment && match.opponentEquipment.length > 0
      ? match.opponentEquipment.join(', ')
      : '-';

  const header = [
    `=== PARTIDA TALISHAR: ${match.player.hero || 'Meu Herói'} vs ${match.opponent.hero || 'Oponente'} ===`,
    `Data: ${match.timestamp}`,
    `Jogador: ${match.player.name || 'Jogador'} (${match.player.hero || '-'})`,
    `Adversário: ${match.opponent.name || 'Oponente'} (${match.opponent.hero || '-'})`,
    `Resultado: ${translateResult(match.result)}`,
    `Iniciou: ${match.wentFirst === undefined ? '-' : match.wentFirst ? 'Sim' : 'Não'}`,
    `Turnos: ${match.turnsCount}`,
    `Meu Valor Médio/Turno: ${formatDecimalPtBr(match.player.avgTurnValue)}`,
    `Valor Médio/Turno Oponente: ${formatDecimalPtBr(match.opponent.avgTurnValue)}`,
    `Meu Equipamento: ${playerEquipText}`,
    `Equipamento Oponente: ${oppEquipText}`,
    `Sideboard / Cartas Fora: ${sideboardText}`,
    `Notas: ${match.notes || '-'}`,
    '',
    '--- ESTATÍSTICAS AVANÇADAS ---',
    `Turno de Maior Dano (Meu): ${match.player.maxDamage ?? 0} de dano (Turno ${match.player.maxDamageTurn ?? 0})`,
    `Turno de Maior Dano (Oponente): ${match.opponent.maxDamage ?? 0} de dano (Turno ${match.opponent.maxDamageTurn ?? 0})`,
    `Fadiga (Cartas no deck ao fim): Eu (${match.player.fatigue ?? '?'}) | Oponente (${match.opponent.fatigue ?? '?'})`,
    '',
    '--- LOG DE COMBATE COMPLETO (PERSONAGENS / IA) ---',
  ].join('\n');

  const pitchMap = buildKnownPitchMap(match);

  const rawLogs = match.rawLogs && match.rawLogs.length > 0
    ? replacePlayerNamesWithHeroes(match.rawLogs, match.player, match.opponent)
    : [];

  // Decorate lines with pitch codes
  const pitchDecoratedLogs = rawLogs.map((l) => decorateLineWithPitches(l, pitchMap));

  // Enrich chain link headers with attack card and damage
  const chainEnrichedLogs = enrichChainLinksWithDamage(pitchDecoratedLogs, pitchMap);

  const formattedLines: string[] = [];
  chainEnrichedLogs.forEach((line) => {
    if (/^---?\s*Turn/i.test(line) || /^Turn\s+\d+/i.test(line)) {
      const clean = line.replace(/^-+\s*/, '').replace(/\s*-+$/, '');
      formattedLines.push('');
      formattedLines.push('--------------------------------------------------');
      formattedLines.push(`--- ${clean} ---`);
      formattedLines.push('--------------------------------------------------');
    } else {
      formattedLines.push(line);
    }
  });

  const logs = formattedLines.length > 0
    ? formattedLines.join('\n')
    : '(Nenhum log registrado)';

  return `${header}\n${logs}\n`;
}
