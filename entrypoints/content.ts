import { defineContentScript } from 'wxt/sandbox';
import {
  extractMatchRecordFromDom,
  parseMatchResult,
  parseCombatLogs,
  parseAverageTurnValues,
} from '../src/parsers/talisharDom';
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
    let matchEndedHandled = false;
    let modalElement: HTMLElement | null = null;

    // Helper to open the export dialog
    const openNotesModal = async (matchData: MatchRecord) => {
      if (modalElement && document.body.contains(modalElement)) {
        if (modalElement.style.display === 'none') {
          modalElement.style.display = 'flex';
        }
        return;
      }

      const freshSettings = await getSettings();

      modalElement = createExportModal({
        match: matchData,
        webhookUrl: freshSettings.googleSheetsWebhookUrl,
        spreadsheetUrl: freshSettings.googleSpreadsheetUrl,
        onRefreshStats: () =>
          parseAverageTurnValues(
            document,
            matchData.opponent?.name,
            matchData.player?.name,
            matchData.player?.avgTurnValue
          ),
        onSaveToSheets: async (updatedMatch): Promise<SheetsResponse> => {
          try {
            const currentSettings = await getSettings();
            // Dispatch via Background Script to bypass page CSP and CORS restrictions
            const response = (await browser.runtime.sendMessage({
              type: 'SEND_TO_SHEETS',
              match: updatedMatch,
              webhookUrl: currentSettings.googleSheetsWebhookUrl,
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

      (modalElement as any)._oppName = matchData.opponent?.name;
      (modalElement as any)._playerName = matchData.player?.name;
      (modalElement as any)._playerAvg = matchData.player?.avgTurnValue;

      document.body.appendChild(modalElement);
    };

    // Helper to show floating trigger button
    const showFloatingButton = (matchData: MatchRecord) => {
      let btn = document.getElementById('talishar-log-export-btn');
      if (!btn) {
        btn = createFloatingButton(() => {
          if (modalElement && document.body.contains(modalElement)) {
            modalElement.style.display = 'flex';
            return;
          }

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
            rawLogs: latestSnapshot.rawLogs || [],
          };
          openNotesModal(merged);
        });
        document.body.appendChild(btn);
      }
    };

    // Debounced and throttled page state checker to guarantee 0 lag and eliminate browser slowdown
    let checkScheduled = false;

    const performPageCheck = () => {
      checkScheduled = false;
      
      const hasGameOver =
        document.querySelector(
          '[class*="outcomeVictory"], [class*="OutcomeVictory"], [class*="outcomeDefeat"], [class*="OutcomeDefeat"], [class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"], [class*="matchResult"], [class*="victory"], [class*="defeat"], [class*="Victory"], [class*="Defeat"]'
        ) !== null || Array.from(document.querySelectorAll('h1, h2, h3, div')).some(el => {
          const txt = el.textContent?.trim().toLowerCase() || '';
          return (txt === 'victory' || txt === 'defeat' || txt === 'you win' || txt === 'you lose' || txt === 'game over' || txt.includes('average value per turn'));
        });

      const isInLobby = isPreGameLobby(document);
      const isIngame = document.querySelector('[class*="chatBox"], [class*="PlayerBoardGrid"], [class*="playerBoard"], [class*="combatGroupLabel"]') !== null;

      let currentState = 'desconhecido';
      if (hasGameOver && !matchEndedHandled) currentState = 'Fim de Partida (Game Over)';
      else if (isInLobby) currentState = 'Lobby / Preparação';
      else if (isIngame && !matchEndedHandled) currentState = 'Partida em Andamento';

      // Avoid spamming the console 500 times a second
      if ((window as any)._lastTalisharState !== currentState) {
        console.log(`[Talishar Log Exporter] 🔍 Estado mudou para: ${currentState}`);
        (window as any)._lastTalisharState = currentState;
      }

      if (hasGameOver || isInLobby || isIngame) {
        browser.runtime.sendMessage({ type: 'UPDATE_STATUS', status: 'active' }).catch(() => {});
      } else {
        browser.runtime.sendMessage({ type: 'UPDATE_STATUS', status: 'error' }).catch(() => {});
      }

      // 1. Pre-game Lobby / In-Game Stage: Reset state if we are no longer in game over screen
      if (!hasGameOver) {
        if (matchEndedHandled) {
          matchEndedHandled = false;
          modalElement = null;
        }
        
        if (isInLobby) {
          const adjustment = trackLobbyDeckState(document);
          if ((adjustment.mainDeckCount ?? 0) > 0) {
            currentDeckAdjustment = adjustment;
            saveSideboardToStorage(adjustment);
          }
          const oldBtn = document.getElementById('talishar-log-export-btn');
          if (oldBtn) oldBtn.remove();
        }
      }

      // 2. In-game: If InventoryModal opens, capture inventory cards as sideboard
      if (!matchEndedHandled && !hasGameOver) {
        const inventoryContainer = document.querySelector('[class*="inventory"], [class*="Inventory"]');
        if (inventoryContainer) {
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
        }
      }

      // 3. Game Over Stage: Check for victory/defeat or end game container
      if (!matchEndedHandled) {
        if (hasGameOver) {
          const result = parseMatchResult(document);
          if (
            result !== 'unknown' ||
            document.querySelector('[class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"], [class*="matchResult"]') !== null
          ) {
            matchEndedHandled = true;

            const snapshot = extractMatchRecordFromDom(document);
            const savedAdjustment = currentDeckAdjustment || getSavedSideboard();
            const registeredPlayerName = settings.playerName?.trim();
            const finalPlayerName = registeredPlayerName || snapshot.player?.name || 'Jogador';

            const completedMatch: MatchRecord = {
              id: `talishar-${Date.now()}`,
              timestamp: new Date().toISOString(),
              player: {
                hero: snapshot.player?.hero || '-',
                name: finalPlayerName,
                avgTurnValue: snapshot.player?.avgTurnValue,
              },
              opponent: snapshot.opponent || { name: 'Oponente', hero: '-' },
              result: snapshot.result || 'unknown',
              turnsCount: snapshot.turnsCount || 1,
              sideboardCards: savedAdjustment?.cardsLeftOut || [],
              playerEquipment: snapshot.playerEquipment || [],
              opponentEquipment: snapshot.opponentEquipment || [],
              notes: '',
              rawLogs: snapshot.rawLogs || [],
              format: snapshot.format || 'CC',
              wentFirst: snapshot.wentFirst,
              platform: 'Talishar',
            };

            showFloatingButton(completedMatch);

            if (settings.autoOpenNotesModal) {
              openNotesModal(completedMatch);
            }
          }
        }
      }

      // 4. If match ended and modal is open, poll opponent tab stats at most once per second
      if (matchEndedHandled && modalElement && document.body.contains(modalElement)) {
        const stats = parseAverageTurnValues(
          document,
          (modalElement as any)._oppName,
          (modalElement as any)._playerName,
          (modalElement as any)._playerAvg
        );
        if (stats.opponentAvgTurnValue !== undefined) {
          (modalElement as any).updateOpponentAvg?.(stats.opponentAvgTurnValue);
        }
      }
    };

    const scheduleCheck = () => {
      if (checkScheduled) return;
      checkScheduled = true;
      window.setTimeout(performPageCheck, 500);
    };

    // Observer to monitor Talishar page state continuously without CPU lag
    const observer = new MutationObserver((mutations) => {
      // Ignore mutations originating from our own modal or floating button
      const allOurUI = mutations.every((m) => {
        const el = m.target as HTMLElement;
        return (
          el &&
          typeof el.closest === 'function' &&
          (el.closest('#talishar-export-modal') !== null || el.closest('#talishar-log-export-btn') !== null)
        );
      });

      if (allOurUI) return;

      scheduleCheck();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Captura instantânea ao clicar em qualquer elemento da página do jogo (ex: abas do Talishar)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target && typeof target.closest === 'function' && target.closest('#talishar-export-modal')) {
        return;
      }
      if (matchEndedHandled && modalElement && document.body.contains(modalElement)) {
        [50, 150, 400].forEach((delay) => {
          window.setTimeout(() => {
            if (!modalElement || !document.body.contains(modalElement)) return;
            const stats = parseAverageTurnValues(
              document,
              (modalElement as any)._oppName,
              (modalElement as any)._playerName,
              (modalElement as any)._playerAvg
            );
            if (stats.opponentAvgTurnValue !== undefined) {
              (modalElement as any).updateOpponentAvg?.(stats.opponentAvgTurnValue);
            }
          }, delay);
        });
      }
    });

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === 'PING_STATUS') {
        const hasGameOver = document.querySelector('[class*="outcomeVictory"]') !== null || 
                            document.querySelector('[class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"], [class*="matchResult"]') !== null;
        const isInLobby = isPreGameLobby(document);
        const isIngame = document.querySelector('[class*="chatBox"], [class*="PlayerBoardGrid"], [class*="playerBoard"], [class*="combatGroupLabel"]') !== null;
        
        return Promise.resolve({ status: (hasGameOver || isInLobby || isIngame) ? 'active' : 'error' });
      }
    });
  },
});
