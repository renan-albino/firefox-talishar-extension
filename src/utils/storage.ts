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
  // Keep latest 100 matches in storage
  const updated = [match, ...history.filter((m) => m.id !== match.id)].slice(0, 100);
  await storage.setItem(HISTORY_KEY, updated);
}

export async function getMatchHistory(): Promise<MatchRecord[]> {
  const saved = await storage.getItem<MatchRecord[]>(HISTORY_KEY);
  return saved || [];
}
