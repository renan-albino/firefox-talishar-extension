import { storage } from 'wxt/storage';
import type { ExtensionSettings, MatchRecord } from '../types/match';

const SETTINGS_KEY = 'local:extensionSettings';
const HISTORY_KEY = 'local:matchHistory';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  googleSheetsWebhookUrl: '',
  autoOpenNotesModal: true,
  exportFormatPreference: 'both',
  playerName: '',
  googleSpreadsheetUrl: '',
};

export async function getSettings(): Promise<ExtensionSettings> {
  const saved = await storage.getItem<ExtensionSettings>(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(saved || {}),
  };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  const updated: ExtensionSettings = {
    ...current,
    ...settings,
  };
  await storage.setItem(SETTINGS_KEY, updated);
}

export async function saveMatchToHistory(match: MatchRecord): Promise<void> {
  const history = await getMatchHistory();
  // Filter out any existing record with the same ID
  const filtered = history.filter((m) => m.id !== match.id);
  // Keep chronological order: append new matches at the bottom (latest at the end)
  const updated = [...filtered, match].slice(-2000);
  await storage.setItem(HISTORY_KEY, updated);
}

export async function getMatchHistory(): Promise<MatchRecord[]> {
  const saved = await storage.getItem<MatchRecord[]>(HISTORY_KEY);
  if (!saved || saved.length === 0) return [];
  // Return in exact sequence with new matches appended at the bottom
  return saved;
}

export async function getLatestMatch(): Promise<MatchRecord | null> {
  const history = await getMatchHistory();
  if (history.length === 0) return null;
  return history[history.length - 1];
}

/**
 * Parses an imported CSV string and merges it into local storage history.
 * Minimal parser assumes standard CSV_HEADERS order from csvFormatter.
 */
export async function importMatchesFromCsv(csvText: string): Promise<number> {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return 0; // only header or empty

  const newRecords: MatchRecord[] = [];
  
  // Skip header (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Very basic CSV parser to handle quotes
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j+1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ';' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current);

    if (fields.length < 13) continue; // Malformed row

    const [
      dia, jogador, deck, matchOpponent, formato, resultado, iniciou, 
      plataforma, adversario, observacoes, turnos, meuValor, oppValor, sideboard
    ] = fields;

    // Convert date string dd/MM/yyyy or yyyy-MM-dd to ISO
    let timestamp = new Date().toISOString();
    if (dia) {
      const cleanDia = dia.replace(/['"]/g, '').trim();
      if (cleanDia.includes('/')) {
        const parts = cleanDia.split('/');
        if (parts.length === 3) {
          const year = parts[2].length === 2 ? Number(`20${parts[2]}`) : Number(parts[2]);
          const baseDate = new Date(year, Number(parts[1]) - 1, Number(parts[0]));
          baseDate.setSeconds(i % 60);
          baseDate.setMinutes(Math.floor(i / 60) % 60);
          timestamp = baseDate.toISOString();
        }
      } else if (cleanDia.includes('-')) {
        const parts = cleanDia.split('-');
        if (parts.length === 3) {
          const baseDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          baseDate.setSeconds(i % 60);
          baseDate.setMinutes(Math.floor(i / 60) % 60);
          timestamp = baseDate.toISOString();
        }
      }
    }

    const res = resultado.toLowerCase();
    const matchResult = res.includes('vitória') ? 'win' : res.includes('derrota') ? 'loss' : res.includes('empate') ? 'draw' : 'unknown';

    const parseVal = (str: string) => {
      if (!str) return undefined;
      const num = parseFloat(str.replace(',', '.'));
      return isNaN(num) ? undefined : num;
    };

    newRecords.push({
      id: `imported-${Date.now()}-${i}`,
      timestamp,
      player: {
        name: jogador,
        hero: deck,
        avgTurnValue: parseVal(meuValor)
      },
      opponent: {
        name: adversario,
        hero: matchOpponent,
        avgTurnValue: parseVal(oppValor)
      },
      result: matchResult,
      wentFirst: iniciou === 'Sim',
      platform: plataforma || 'Talishar',
      format: formato || 'CC',
      notes: observacoes,
      turnsCount: parseInt(turnos, 10) || 0,
      sideboardCards: sideboard && sideboard !== '-' ? sideboard.split(', ') : [],
      rawLogs: []
    });
  }

  const history = await getMatchHistory();
  // Preserve exact CSV sequence and append to history with new games at the bottom
  const merged = [...history, ...newRecords].slice(-2000);
  await storage.setItem(HISTORY_KEY, merged);
  
  return newRecords.length;
}
