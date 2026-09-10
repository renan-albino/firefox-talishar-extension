import type { MatchRecord, MatchResult } from '../types/match';

const UTF8_BOM = '\uFEFF';
const DELIMITER = ';';

export const CSV_HEADERS = [
  'ID',
  'Data/Hora',
  'Jogador',
  'Heroi',
  'Oponente',
  'Heroi Oponente',
  'Resultado',
  'Turnos',
  'Meu Valor Medio/Turno',
  'Valor Medio/Turno Oponente',
  'Cartas Fora/Sideboard',
  'Notas',
];

function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) {
    return '""';
  }
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
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
      return 'Vitoria';
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

  const fields = [
    escapeCsvField(match.id),
    escapeCsvField(match.timestamp),
    escapeCsvField(match.player.name || 'Jogador'),
    escapeCsvField(match.player.hero || '-'),
    escapeCsvField(match.opponent.name || 'Oponente'),
    escapeCsvField(match.opponent.hero || '-'),
    escapeCsvField(translateResult(match.result)),
    escapeCsvField(match.turnsCount ?? 0),
    escapeCsvField(formatDecimalPtBr(match.player.avgTurnValue)),
    escapeCsvField(formatDecimalPtBr(match.opponent.avgTurnValue)),
    escapeCsvField(sideboardText),
    escapeCsvField(match.notes || ''),
  ];

  return fields.join(DELIMITER);
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

  const header = [
    `=== PARTIDA TALISHAR: ${match.player.hero || 'Meu Heroi'} vs ${match.opponent.hero || 'Oponente'} ===`,
    `Data: ${match.timestamp}`,
    `Resultado: ${translateResult(match.result)}`,
    `Turnos: ${match.turnsCount}`,
    `Meu Valor Medio/Turno: ${formatDecimalPtBr(match.player.avgTurnValue)}`,
    `Valor Medio/Turno Oponente: ${formatDecimalPtBr(match.opponent.avgTurnValue)}`,
    `Sideboard / Cartas Fora: ${sideboardText}`,
    `Notas: ${match.notes || '-'}`,
    '',
    '--- LOG COMPLETO ---',
  ].join('\n');

  const logs = match.rawLogs && match.rawLogs.length > 0
    ? match.rawLogs.join('\n')
    : '(Nenhum log registrado)';

  return `${header}\n${logs}\n`;
}
