import { storage } from 'wxt/storage';
import type { ExtensionSettings, MatchRecord } from '../types/match';

const SETTINGS_KEY = 'local:extensionSettings';
const HISTORY_KEY = 'local:matchHistory';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  googleSheetsWebhookUrl: '',
  autoOpenNotesModal: false,
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
  // Keep latest 2000 matches in storage to allow for long-term historical CSV generation
  const updated = [match, ...history.filter((m) => m.id !== match.id)].slice(0, 2000);
  await storage.setItem(HISTORY_KEY, updated);
}

export async function getMatchHistory(): Promise<MatchRecord[]> {
  const saved = await storage.getItem<MatchRecord[]>(HISTORY_KEY);
  return saved || [];
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

    // Convert date string dd/MM/yyyy to ISO
    let timestamp = new Date().toISOString();
    if (dia && dia.includes('/')) {
      const parts = dia.split('/');
      if (parts.length === 3) {
        timestamp = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).toISOString();
      }
    }

    const res = resultado.toLowerCase();
    const matchResult = res.includes('vitória') ? 'win' : res.includes('derrota') ? 'loss' : res.includes('empate') ? 'draw' : 'unknown';

    const parseVal = (str: string) => {
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
      sideboardCards: sideboard !== '-' ? sideboard.split(', ') : [],
      rawLogs: []
    });
  }

  const history = await getMatchHistory();
  // Merge, avoiding strict duplicates (if possible) - here we just append uniquely generated imported records
  // For simplicity, we just add them to the end of the history.
  const merged = [...history, ...newRecords].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 2000);
  await storage.setItem(HISTORY_KEY, merged);
  
  return newRecords.length;
}
