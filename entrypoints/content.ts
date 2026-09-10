import { defineContentScript } from 'wxt/sandbox';
import { extractMatchRecordFromDom, parseMatchResult } from '../src/parsers/talisharDom';
import { trackLobbyDeckState, isPreGameLobby } from '../src/parsers/sideboardTracker';
import { createFloatingButton } from '../src/ui/floatingButton';
import { createExportModal } from '../src/ui/exportModal';
import { getSettings, saveMatchToHistory } from '../src/utils/storage';
import { sendMatchToSheets } from '../src/services/sheetsClient';
import type { MatchRecord, DeckAdjustment } from '../src/types/match';

export default defineContentScript({
  matches: ['*://*.talishar.net/*'],
  async main() {
    console.log('[Talishar Log Exporter] Content script loaded.');

    let settings = await getSettings();
    let currentDeckAdjustment: DeckAdjustment | null = null;
    let currentMatch: MatchRecord | null = null;
    let matchEndedHandled = false;
    let modalElement: HTMLElement | null = null;

    // Helper to open the export dialog
    const openNotesModal = (matchData: MatchRecord) => {
      if (modalElement && document.body.contains(modalElement)) return;

      modalElement = createExportModal({
        match: matchData,
        webhookUrl: settings.googleSheetsWebhookUrl,
        onSaveToSheets: async (updatedMatch) => {
          const res = await sendMatchToSheets(updatedMatch, settings.googleSheetsWebhookUrl);
          if (res.success) {
            await saveMatchToHistory(updatedMatch);
          }
          return res;
        },
        onClose: () => {
          modalElement = null;
        },
      });

      document.body.appendChild(modalElement);
    };

    // Helper to show floating trigger button
    const showFloatingButton = (matchData: MatchRecord) => {
      let btn = document.getElementById('talishar-log-export-btn');
      if (!btn) {
        btn = createFloatingButton(() => {
          // Re-extract latest stats (e.g. if average turn value or outcome refreshed)
          const latestSnapshot = extractMatchRecordFromDom(document);
          const merged: MatchRecord = {
            ...matchData,
            ...latestSnapshot,
            player: {
              ...matchData.player,
              ...(latestSnapshot.player || {}),
            },
            opponent: {
              ...matchData.opponent,
              ...(latestSnapshot.opponent || {}),
            },
            sideboardCards: currentDeckAdjustment?.cardsLeftOut || matchData.sideboardCards || [],
          };
          openNotesModal(merged);
        });
        document.body.appendChild(btn);
      }
    };

    // Observer to monitor Talishar page state
    const observer = new MutationObserver(() => {
      // 1. Lobby Stage: Capture sideboard / deck adjustments
      if (isPreGameLobby(document)) {
        const adjustment = trackLobbyDeckState(document);
        if ((adjustment.mainDeckCount ?? 0) > 0) {
          currentDeckAdjustment = adjustment;
        }
        // Reset match-ended lock when entering a new lobby
        matchEndedHandled = false;
        const oldBtn = document.getElementById('talishar-log-export-btn');
        if (oldBtn) oldBtn.remove();
      }

      // 2. Game Stage: Check for victory/defeat or end game container
      const result = parseMatchResult(document);
      const isEndGameStats = document.querySelector(
        '[class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"]'
      ) !== null;

      if ((result !== 'unknown' || isEndGameStats) && !matchEndedHandled) {
        matchEndedHandled = true;

        const snapshot = extractMatchRecordFromDom(document);
        currentMatch = {
          id: `talishar-${Date.now()}`,
          timestamp: new Date().toISOString(),
          player: snapshot.player || { name: 'Jogador', hero: '-' },
          opponent: snapshot.opponent || { name: 'Oponente', hero: '-' },
          result: snapshot.result || 'unknown',
          turnsCount: snapshot.turnsCount || 1,
          sideboardCards: currentDeckAdjustment?.cardsLeftOut || [],
          notes: '',
          rawLogs: snapshot.rawLogs || [],
        };

        showFloatingButton(currentMatch);

        if (settings.autoOpenNotesModal) {
          openNotesModal(currentMatch);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
});
