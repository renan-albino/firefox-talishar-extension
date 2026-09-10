import { defineContentScript } from 'wxt/sandbox';
import { extractMatchRecordFromDom, parseMatchResult, parseCombatLogs } from '../src/parsers/talisharDom';
import {
  trackLobbyDeckState,
  isPreGameLobby,
  trackInGameInventory,
  getSavedSideboard,
  saveSideboardToStorage,
} from '../src/parsers/sideboardTracker';
import { createFloatingButton } from '../src/ui/floatingButton';
import { createExportModal } from '../src/ui/exportModal';
import { getSettings, saveMatchToHistory } from '../src/utils/storage';
import type { MatchRecord, DeckAdjustment } from '../src/types/match';
import type { SheetsResponse } from '../src/services/sheetsClient';

export default defineContentScript({
  matches: ['*://*.talishar.net/*'],
  async main() {
    console.log('[Talishar Log Exporter] Content script loaded on talishar.net.');

    const settings = await getSettings();
    let currentDeckAdjustment: DeckAdjustment | null = getSavedSideboard();
    let accumulatedLogs: string[] = [];
    let matchEndedHandled = false;
    let modalElement: HTMLElement | null = null;

    // Helper to open the export dialog
    const openNotesModal = (matchData: MatchRecord) => {
      if (modalElement && document.body.contains(modalElement)) return;

      modalElement = createExportModal({
        match: matchData,
        webhookUrl: settings.googleSheetsWebhookUrl,
        onSaveToSheets: async (updatedMatch): Promise<SheetsResponse> => {
          try {
            // Dispatch via Background Script to bypass page CSP and CORS restrictions
            const response = (await browser.runtime.sendMessage({
              type: 'SEND_TO_SHEETS',
              match: updatedMatch,
              webhookUrl: settings.googleSheetsWebhookUrl,
            })) as SheetsResponse | undefined;

            if (response?.success) {
              await saveMatchToHistory(updatedMatch);
            }
            return response || { success: false, error: 'Sem resposta do serviço em segundo plano' };
          } catch (err: any) {
            return {
              success: false,
              error: err?.message || 'Falha na comunicação com a extensão',
            };
          }
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
          const savedAdjustment = currentDeckAdjustment || getSavedSideboard();
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
            sideboardCards: savedAdjustment?.cardsLeftOut || matchData.sideboardCards || [],
            rawLogs: accumulatedLogs.length > 0 ? accumulatedLogs : latestSnapshot.rawLogs || [],
          };
          openNotesModal(merged);
        });
        document.body.appendChild(btn);
      }
    };

    // Observer to monitor Talishar page state continuously
    const observer = new MutationObserver(() => {
      // 1. Pre-game Lobby Stage: Capture sideboard / deck adjustments
      if (isPreGameLobby(document)) {
        const adjustment = trackLobbyDeckState(document);
        if ((adjustment.mainDeckCount ?? 0) > 0) {
          currentDeckAdjustment = adjustment;
          saveSideboardToStorage(adjustment);
        }
        matchEndedHandled = false;
        accumulatedLogs.length = 0;
        const oldBtn = document.getElementById('talishar-log-export-btn');
        if (oldBtn) oldBtn.remove();
      }

      // 2. In-game: Keep the most up-to-date combat logs
      const liveLogs = parseCombatLogs(document);
      if (liveLogs.length > accumulatedLogs.length) {
        accumulatedLogs = liveLogs;
      }

      // 3. In-game: If InventoryModal opens, capture inventory cards as sideboard
      const inventoryCards = trackInGameInventory(document);
      if (inventoryCards.length > 0) {
        if (!currentDeckAdjustment) {
          currentDeckAdjustment = {
            cardsLeftOut: inventoryCards,
            cardsAdded: [],
            mainDeckCount: 60 - inventoryCards.length,
          };
        } else {
          currentDeckAdjustment.cardsLeftOut = Array.from(
            new Set([...currentDeckAdjustment.cardsLeftOut, ...inventoryCards])
          );
        }
        saveSideboardToStorage(currentDeckAdjustment);
      }

      // 4. Game Over Stage: Check for victory/defeat or end game container
      const result = parseMatchResult(document);
      const isEndGameStats = document.querySelector(
        '[class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"]'
      ) !== null;

      if ((result !== 'unknown' || isEndGameStats) && !matchEndedHandled) {
        matchEndedHandled = true;

        const snapshot = extractMatchRecordFromDom(document);
        const savedAdjustment = currentDeckAdjustment || getSavedSideboard();

        const completedMatch: MatchRecord = {
          id: `talishar-${Date.now()}`,
          timestamp: new Date().toISOString(),
          player: snapshot.player || { name: 'Jogador', hero: '-' },
          opponent: snapshot.opponent || { name: 'Oponente', hero: '-' },
          result: snapshot.result || 'unknown',
          turnsCount: snapshot.turnsCount || 1,
          sideboardCards: savedAdjustment?.cardsLeftOut || [],
          notes: '',
          rawLogs: accumulatedLogs.length > 0 ? accumulatedLogs : snapshot.rawLogs || [],
        };

        showFloatingButton(completedMatch);

        if (settings.autoOpenNotesModal) {
          openNotesModal(completedMatch);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
});
