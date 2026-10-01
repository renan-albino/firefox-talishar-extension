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

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

  const rawLogs = match.rawLogs && match.rawLogs.length > 0
    ? replacePlayerNamesWithHeroes(match.rawLogs, match.player, match.opponent)
    : [];

  const formattedLines: string[] = [];
  rawLogs.forEach((line) => {
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
