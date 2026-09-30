import {
  extractMatchRecordFromDom,
  parseMatchResult,
  parseCombatLogs,
  parseAverageTurnValues,
  parseEquipment,
  parseFatigue,
  parsePlayerNames,
  autoCaptureEndGameStats,
  findSwitchPlayerStatsButton,
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
import { getSettings, saveMatchToHistory, getMatchHistory } from '../src/utils/storage';
import type { MatchRecord, DeckAdjustment } from '../src/types/match';
import type { SheetsResponse } from '../src/services/sheetsClient';

export default defineContentScript({
  matches: ['*://*.talishar.net/*', '*://talishar.net/*'],
  async main() {
    console.log('[Talishar Log Exporter] Content script loaded on talishar.net.');

    const settings = await getSettings();
    let currentDeckAdjustment: DeckAdjustment | null = getSavedSideboard();
    let matchEndedHandled = false;
    let modalElement: HTMLElement | null = null;

    // Continuous in-game cache to preserve state even if DOM overlays change
    let cachedPlayerEquipment: string[] = [];
    let cachedOpponentEquipment: string[] = [];
    let cachedPlayerFatigue: number | undefined = undefined;
    let cachedOpponentFatigue: number | undefined = undefined;
    let cachedPlayerUsername: string | undefined = undefined;
    let cachedOpponentUsername: string | undefined = undefined;

    // Helper to get or create a CMP-whitelisted container inside document.body so Talishar useAdScript never hides or locks it
    const getExtensionMountHost = (): HTMLElement => {
      let host = document.getElementById('sp_message_container_talishar');
      if (!host || !document.body?.contains(host)) {
        if (host) host.remove();
        host = document.createElement('div');
        host.id = 'sp_message_container_talishar';
        host.className = 'sp_message_container';
        host.style.cssText = 'position: static; pointer-events: auto !important; z-index: 2147483647 !important;';
        (document.body || document.documentElement).appendChild(host);
      }
      return host;
    };

    // Helper to open the export dialog
    const openNotesModal = async (matchData: MatchRecord) => {
      // Force remove any old modal so it reconstructs with the correct match data
      const existingInDom = document.getElementById('talishar-export-modal');
      if (existingInDom) existingInDom.remove();
      modalElement = null;

      const freshSettings = await getSettings();

      modalElement = createExportModal({
        match: matchData,
        webhookUrl: freshSettings.googleSheetsWebhookUrl,
        spreadsheetUrl: freshSettings.googleSpreadsheetUrl,
        onRefreshStats: () =>
          autoCaptureEndGameStats(document, {
            opponentNameOrHero: matchData.opponent?.name || matchData.opponent?.hero,
            playerNameOrHero: matchData.player?.name || matchData.player?.hero,
          }),
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

      const host = getExtensionMountHost();
      host.appendChild(modalElement);
    };

    // Helper to show floating trigger button
    const showFloatingButton = (matchData: MatchRecord) => {
      let btn = document.getElementById('talishar-log-export-btn');
      if (btn) btn.remove();
      
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
          rawLogs: latestSnapshot.rawLogs || [],
        };

        if (modalElement && document.contains(modalElement)) {
          modalElement.style.setProperty('display', 'flex', 'important');
          modalElement.style.setProperty('visibility', 'visible', 'important');
          modalElement.style.setProperty('pointer-events', 'auto', 'important');
          return;
        }

        openNotesModal(merged);
      });
      const host = getExtensionMountHost();
      host.appendChild(btn);
    };

    // Debounced and throttled page state checker to guarantee 0 lag and eliminate browser slowdown
    let checkScheduled = false;

    const performPageCheck = () => {
      checkScheduled = false;
      
      const combatLogs = parseCombatLogs(document);
      const hasGameOver =
        document.querySelector(
          '[class*="outcomeVictory"], [class*="OutcomeVictory"], [class*="outcomeDefeat"], [class*="OutcomeDefeat"], [class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"], [class*="cardListBox"], [class*="cardListTitle"], [class*="matchResult"], [class*="victory"], [class*="defeat"], [class*="Victory"], [class*="Defeat"], [class*="gameOver"], [class*="GameOver"]'
        ) !== null ||
        Array.from(document.querySelectorAll('h1, h2, h3, button, [role="heading"]')).some((el) => {
          const txt = el.textContent?.trim().toLowerCase() || '';
          return (
            txt === 'victory' ||
            txt === 'defeat' ||
            txt === 'you win' ||
            txt === 'you lose' ||
            txt === 'game over' ||
            txt === 'rematch'
          );
        }) ||
        combatLogs.some((line) => {
          const l = line.toLowerCase();
          return (
            l.includes('conceded') ||
            l.includes('won the game') ||
            l.includes('was defeated') ||
            l.includes('has won the game') ||
            l.includes('has been defeated')
          );
        });

      const isInLobby = isPreGameLobby(document);
      const isIngame =
        document.querySelector(
          '[class*="chatBox"], [class*="PlayerBoardGrid"], [class*="playerBoard"], [class*="combatGroupLabel"]'
        ) !== null;

      let currentState = 'desconhecido';
      if (matchEndedHandled || hasGameOver) currentState = 'Fim de Partida (Game Over)';
      else if (isInLobby) currentState = 'Lobby / Preparação';
      else if (isIngame) currentState = 'Partida em Andamento';

      // Avoid spamming the console 500 times a second
      if ((window as any)._lastTalisharState !== currentState) {
        console.log(`[Talishar Log Exporter] 🔍 Estado mudou para: ${currentState}`);
        (window as any)._lastTalisharState = currentState;
      }

      if (hasGameOver || isInLobby || isIngame || matchEndedHandled) {
        browser.runtime.sendMessage({ type: 'UPDATE_STATUS', status: 'active' }).catch(() => {});
      } else {
        browser.runtime.sendMessage({ type: 'UPDATE_STATUS', status: 'error' }).catch(() => {});
      }

      // 1. Pre-game Lobby Stage: Reset state only when genuinely in a new lobby
      if (isInLobby && !hasGameOver) {
        if (matchEndedHandled && !isIngame) {
          matchEndedHandled = false;
          modalElement = null;
          const oldBtn = document.getElementById('talishar-log-export-btn');
          if (oldBtn) oldBtn.remove();
          const oldHost = document.getElementById('sp_message_container_talishar');
          if (oldHost) oldHost.remove();
        }

        const adjustment = trackLobbyDeckState(document);
        if ((adjustment.mainDeckCount ?? 0) > 0 || adjustment.cardsLeftOut.length > 0) {
          currentDeckAdjustment = adjustment;
          saveSideboardToStorage(adjustment);
        }
      }

      // 2. In-game live caching: equipment, fatigue, usernames, and inventory
      if (isIngame && !hasGameOver) {
        const liveEquip = parseEquipment(document, cachedPlayerEquipment, cachedOpponentEquipment);
        if (liveEquip.playerEquipment.length > 0) cachedPlayerEquipment = liveEquip.playerEquipment;
        if (liveEquip.opponentEquipment.length > 0) cachedOpponentEquipment = liveEquip.opponentEquipment;

        const liveFatigue = parseFatigue(document, cachedPlayerFatigue, cachedOpponentFatigue);
        if (liveFatigue.playerFatigue !== undefined) cachedPlayerFatigue = liveFatigue.playerFatigue;
        if (liveFatigue.opponentFatigue !== undefined) cachedOpponentFatigue = liveFatigue.opponentFatigue;

        const liveNames = parsePlayerNames(document);
        if (liveNames.playerUsername) cachedPlayerUsername = liveNames.playerUsername;
        if (liveNames.opponentUsername) cachedOpponentUsername = liveNames.opponentUsername;

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
      if (!matchEndedHandled && hasGameOver) {
        matchEndedHandled = true;

        (async () => {
          const snapshot = extractMatchRecordFromDom(document, {
            cachedPlayerEquipment,
            cachedOpponentEquipment,
            cachedPlayerFatigue,
            cachedOpponentFatigue,
          });

          // Automated capture: click excludeLastTurn (if not checked) and switch player to capture opponent avg
          let autoStats: { playerAvgTurnValue?: number; opponentAvgTurnValue?: number } = {};
          try {
            await new Promise((r) => setTimeout(r, 180));
            autoStats = await autoCaptureEndGameStats(document, {
              opponentNameOrHero: snapshot.opponent?.name || snapshot.opponent?.hero,
              playerNameOrHero: snapshot.player?.name || snapshot.player?.hero,
            });
          } catch (e) {
            console.warn('[Talishar Log Exporter] Erro no autoCaptureEndGameStats inicial:', e);
          }

          const finalPlayerAvg = autoStats.playerAvgTurnValue ?? snapshot.player?.avgTurnValue;
          const finalOpponentAvg = autoStats.opponentAvgTurnValue ?? snapshot.opponent?.avgTurnValue;

          const savedAdjustment = currentDeckAdjustment || getSavedSideboard();
          const registeredPlayerName = settings.playerName?.trim();
          const finalPlayerName = registeredPlayerName || snapshot.player?.name || 'Jogador';
          const finalPlayerUsername = cachedPlayerUsername || snapshot.player?.username;
          const finalOpponentUsername = cachedOpponentUsername || snapshot.opponent?.username;

          const completedMatch: MatchRecord = {
            id: `talishar-${Date.now()}`,
            timestamp: new Date().toISOString(),
            player: {
              hero: snapshot.player?.hero || '-',
              name: finalPlayerName,
              username: finalPlayerUsername,
              avgTurnValue: finalPlayerAvg,
              fatigue: snapshot.player?.fatigue ?? cachedPlayerFatigue,
              maxDamage: snapshot.player?.maxDamage,
              maxDamageTurn: snapshot.player?.maxDamageTurn,
            },
            opponent: {
              hero: snapshot.opponent?.hero || '-',
              name: snapshot.opponent?.name || 'Oponente',
              username: finalOpponentUsername,
              avgTurnValue: finalOpponentAvg,
              fatigue: snapshot.opponent?.fatigue ?? cachedOpponentFatigue,
              maxDamage: snapshot.opponent?.maxDamage,
              maxDamageTurn: snapshot.opponent?.maxDamageTurn,
            },
            result: snapshot.result || 'unknown',
            turnsCount: snapshot.turnsCount || 1,
            sideboardCards: savedAdjustment?.cardsLeftOut || [],
            playerEquipment:
              snapshot.playerEquipment && snapshot.playerEquipment.length > 0
                ? snapshot.playerEquipment
                : cachedPlayerEquipment,
            opponentEquipment:
              snapshot.opponentEquipment && snapshot.opponentEquipment.length > 0
                ? snapshot.opponentEquipment
                : cachedOpponentEquipment,
            notes: '',
            rawLogs: snapshot.rawLogs || [],
            format: snapshot.format || 'CC',
            wentFirst: snapshot.wentFirst,
            platform: 'Talishar',
          };

          // AUTO-SAVE to local DB instantly so no data is ever lost
          saveMatchToHistory(completedMatch).catch(console.error);

          showFloatingButton(completedMatch);

          // Open in-game modal by default, which contains the "Abrir em Janela Separada" button
          getSettings()
            .then((freshSettings) => {
              if (freshSettings.autoOpenNotesModal !== false) {
                console.log('[Talishar Log Exporter] 🚀 Fim de partida: Abrindo modal no jogo...');
                openNotesModal(completedMatch);
              }
            })
            .catch(() => {
              openNotesModal(completedMatch);
            });
        })().catch(console.error);
      }

      // 4. If match ended and modal is open, poll opponent tab stats at most once per second
      if (matchEndedHandled && modalElement && document.contains(modalElement)) {
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
      if (matchEndedHandled && modalElement && document.contains(modalElement)) {
        [50, 150, 400].forEach((delay) => {
          window.setTimeout(() => {
            if (!modalElement || !document.contains(modalElement)) return;
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

    // Instant capture when changing checkboxes or radios in lobby
    document.addEventListener('change', () => {
      if (isPreGameLobby(document)) {
        const adjustment = trackLobbyDeckState(document);
        if ((adjustment.mainDeckCount ?? 0) > 0 || adjustment.cardsLeftOut.length > 0) {
          currentDeckAdjustment = adjustment;
          saveSideboardToStorage(adjustment);
        }
      }
    });

    browser.runtime.onMessage.addListener(async (message: any) => {
      if (message?.type === 'PING_STATUS') {
        const hasGameOver =
          document.querySelector('[class*="outcomeVictory"]') !== null ||
          document.querySelector(
            '[class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"], [class*="matchResult"], [class*="victory"], [class*="defeat"], [class*="gameOver"]'
          ) !== null;
        const isInLobby = isPreGameLobby(document);
        const isIngame =
          document.querySelector(
            '[class*="chatBox"], [class*="PlayerBoardGrid"], [class*="playerBoard"], [class*="combatGroupLabel"], [class*="pOneDeck"], [class*="pTwoDeck"]'
          ) !== null;

        return { status: hasGameOver || isInLobby || isIngame ? 'active' : 'error' };
      }

      if (message?.type === 'OPEN_MODAL_LAST_MATCH') {
        try {
          // 1. Try to extract current match on screen if there is an active/finished game
          const domSnapshot = extractMatchRecordFromDom(document, {
            cachedPlayerEquipment,
            cachedOpponentEquipment,
            cachedPlayerFatigue,
            cachedOpponentFatigue,
          });
          const hasDomGame = Boolean(
            (domSnapshot.player?.hero && domSnapshot.player.hero !== '-') ||
            (domSnapshot.opponent?.hero && domSnapshot.opponent.hero !== '-') ||
            (domSnapshot.turnsCount && domSnapshot.turnsCount > 1) ||
            (domSnapshot.rawLogs && domSnapshot.rawLogs.length > 0)
          );

          let targetMatch: MatchRecord | null = null;

          if (hasDomGame) {
            const savedAdjustment = currentDeckAdjustment || getSavedSideboard();
            const currentSettings = await getSettings();
            const registeredPlayerName = currentSettings.playerName?.trim();
            const finalPlayerName = registeredPlayerName || domSnapshot.player?.name || 'Jogador';
            const finalPlayerUsername = cachedPlayerUsername || domSnapshot.player?.username;
            const finalOpponentUsername = cachedOpponentUsername || domSnapshot.opponent?.username;

            targetMatch = {
              id: `talishar-${Date.now()}`,
              timestamp: new Date().toISOString(),
              player: {
                hero: domSnapshot.player?.hero || '-',
                name: finalPlayerName,
                username: finalPlayerUsername,
                avgTurnValue: domSnapshot.player?.avgTurnValue,
                fatigue: domSnapshot.player?.fatigue ?? cachedPlayerFatigue,
                maxDamage: domSnapshot.player?.maxDamage,
                maxDamageTurn: domSnapshot.player?.maxDamageTurn,
              },
              opponent: {
                hero: domSnapshot.opponent?.hero || '-',
                name: domSnapshot.opponent?.name || 'Oponente',
                username: finalOpponentUsername,
                avgTurnValue: domSnapshot.opponent?.avgTurnValue,
                fatigue: domSnapshot.opponent?.fatigue ?? cachedOpponentFatigue,
                maxDamage: domSnapshot.opponent?.maxDamage,
                maxDamageTurn: domSnapshot.opponent?.maxDamageTurn,
              },
              result: domSnapshot.result || 'unknown',
              turnsCount: domSnapshot.turnsCount || 1,
              sideboardCards: savedAdjustment?.cardsLeftOut || [],
              playerEquipment:
                domSnapshot.playerEquipment && domSnapshot.playerEquipment.length > 0
                  ? domSnapshot.playerEquipment
                  : cachedPlayerEquipment,
              opponentEquipment:
                domSnapshot.opponentEquipment && domSnapshot.opponentEquipment.length > 0
                  ? domSnapshot.opponentEquipment
                  : cachedOpponentEquipment,
              notes: '',
              rawLogs: domSnapshot.rawLogs || [],
              format: domSnapshot.format || 'CC',
              wentFirst: domSnapshot.wentFirst,
              platform: 'Talishar',
            };
            // Ensure saved into history
            await saveMatchToHistory(targetMatch);
          } else {
            const history = await getMatchHistory();
            if (history && history.length > 0) {
              targetMatch = history[history.length - 1];
            } else {
              // Fallback: Create a draft/editable match so the modal always opens
              const currentSettings = await getSettings();
              targetMatch = {
                id: `talishar-${Date.now()}`,
                timestamp: new Date().toISOString(),
                player: {
                  hero: domSnapshot.player?.hero || '-',
                  name: currentSettings.playerName?.trim() || domSnapshot.player?.name || 'Jogador',
                  username: cachedPlayerUsername,
                },
                opponent: {
                  name: domSnapshot.opponent?.name || 'Oponente',
                  hero: domSnapshot.opponent?.hero || '-',
                  username: cachedOpponentUsername,
                },
                result: 'unknown',
                turnsCount: 1,
                sideboardCards: [],
                playerEquipment: cachedPlayerEquipment,
                opponentEquipment: cachedOpponentEquipment,
                notes: '',
                rawLogs: domSnapshot.rawLogs || [],
                format: 'CC',
                wentFirst: false,
                platform: 'Talishar',
              };
            }
          }

          showFloatingButton(targetMatch);
          await openNotesModal(targetMatch);
          return { success: true };
        } catch (err: any) {
          console.error('[Talishar Log Exporter] Erro ao abrir modal:', err);
          return { success: false, reason: err?.message || 'Erro inesperado ao abrir o modal.' };
        }
      }

      if (message?.type === 'GET_CURRENT_MATCH') {
        let autoStats: { playerAvgTurnValue?: number; opponentAvgTurnValue?: number } = {};
        if (
          document.querySelector(
            '[class*="excludeLastTurnCheckbox"], [class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"]'
          ) ||
          findSwitchPlayerStatsButton(document)
        ) {
          try {
            autoStats = await autoCaptureEndGameStats(document, {
              opponentNameOrHero: cachedOpponentUsername,
              playerNameOrHero: cachedPlayerUsername,
            });
          } catch (e) {
            console.warn('[Talishar Log Exporter] Erro no autoCaptureEndGameStats via GET_CURRENT_MATCH:', e);
          }
        }
        const domSnapshot = extractMatchRecordFromDom(document, {
          cachedPlayerEquipment,
          cachedOpponentEquipment,
          cachedPlayerFatigue,
          cachedOpponentFatigue,
        });
        if (autoStats.playerAvgTurnValue !== undefined && domSnapshot.player) {
          domSnapshot.player.avgTurnValue = autoStats.playerAvgTurnValue;
        }
        if (autoStats.opponentAvgTurnValue !== undefined && domSnapshot.opponent) {
          domSnapshot.opponent.avgTurnValue = autoStats.opponentAvgTurnValue;
        }
        return { success: true, match: domSnapshot };
      }

      return undefined;
    });
  },
});
