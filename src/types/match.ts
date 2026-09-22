/**
 * Domain data models for Talishar Log Exporter
 */

export interface PlayerStats {
  name: string;
  hero: string;
  avgTurnValue?: number;
  finalHealth?: number;
}

export interface CombatLogEntry {
  turn?: number;
  rawText: string;
  timestamp?: string;
}

export interface DeckAdjustment {
  cardsLeftOut: string[];
  cardsAdded: string[];
  mainDeckCount?: number;
}

export type MatchResult = 'win' | 'loss' | 'draw' | 'unknown';

export interface MatchRecord {
  id: string;
  timestamp: string; // ISO 8601
  player: PlayerStats;
  opponent: PlayerStats;
  result: MatchResult;
  turnsCount: number;
  sideboardCards: string[]; // Cards left out or swapped
  playerEquipment?: string[];
  opponentEquipment?: string[];
  notes: string;
  rawLogs: string[];
  format?: string;
  wentFirst?: boolean;
  platform?: string;
}

export interface ExtensionSettings {
  googleSheetsWebhookUrl: string;
  autoOpenNotesModal: boolean;
  exportFormatPreference: 'both' | 'csv' | 'sheets';
  playerName?: string;
  googleSpreadsheetUrl?: string;
}
