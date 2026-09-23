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
  player?: { name?: string; hero?: string },
  opponent?: { name?: string; hero?: string }
): string[] {
  if (!logLines || logLines.length === 0) return [];

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const replacements: Array<{ name: string; hero: string }> = [];

  const pName = player?.name?.trim();
  const pHero = player?.hero?.trim();
  if (pName && pHero && pHero !== '-' && pName.toLowerCase() !== pHero.toLowerCase()) {
    replacements.push({ name: pName, hero: pHero });
  }

  const oName = opponent?.name?.trim();
  const oHero = opponent?.hero?.trim();
  if (oName && oHero && oHero !== '-' && oName.toLowerCase() !== oHero.toLowerCase()) {
    replacements.push({ name: oName, hero: oHero });
  }

  if (replacements.length === 0) return logLines;

  replacements.sort((a, b) => b.name.length - a.name.length);

  return logLines.map((line) => {
    let modified = line;
    for (const { name, hero } of replacements) {
      const boundaryStart = /^\w/.test(name) ? '\\b' : '';
      const boundaryEnd = /\w$/.test(name) ? '\\b' : '';
      const regex = new RegExp(`${boundaryStart}${escapeRegex(name)}${boundaryEnd}`, 'g');
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

  const logs = rawLogs.length > 0
    ? rawLogs.join('\n')
    : '(Nenhum log registrado)';

  return `${header}\n${logs}\n`;
}
