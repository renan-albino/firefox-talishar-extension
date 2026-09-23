import type { MatchRecord, MatchResult, PlayerStats } from '../types/match';
import { formatTalisharCardName } from './sideboardTracker';

/**
 * Extracts player and opponent usernames from the Talishar DOM.
 */
export function parsePlayerNames(doc: Document): { player?: string; opponent?: string } {
  let player: string | undefined;
  let opponent: string | undefined;

  // 1. Try finding by board grid containers (Player vs Opponent)
  const playerBoard = doc.querySelector('[class*="PlayerBoardGrid"], [class*="playerBoard"]');
  const opponentBoard = doc.querySelector('[class*="OpponentBoardGrid"], [class*="opponentBoard"]');

  const extractNameFromElement = (el: Element | null): string | undefined => {
    if (!el) return undefined;
    const nameContent = el.querySelector('[class*="nameContent"], [class*="NameContent"]');
    if (nameContent && nameContent.textContent) {
      return nameContent.textContent.trim();
    }
    const nameContainer = el.querySelector('[class*="nameContainer"], [class*="NameContainer"]');
    if (nameContainer && nameContainer.textContent) {
      return nameContainer.textContent.trim();
    }
    return el.textContent?.trim();
  };

  if (playerBoard) {
    const playerEl = playerBoard.querySelector('[class*="playerName"], [class*="PlayerName"]');
    player = extractNameFromElement(playerEl);
  }

  if (opponentBoard) {
    const oppEl = opponentBoard.querySelector('[class*="playerName"], [class*="PlayerName"]');
    opponent = extractNameFromElement(oppEl);
  }

  // 2. Fallback: Check top bar / right column mobile bar for opponent name
  if (!opponent) {
    const topBarOpp = doc.querySelector('[class*="mobileTopBarName"] [class*="playerName"], [class*="mobileTopBar"] [class*="playerName"]');
    if (topBarOpp) {
      opponent = extractNameFromElement(topBarOpp);
    }
  }

  // 3. Fallback: Search all playerName elements by class differentiation
  if (!player || !opponent) {
    const allNameEls = Array.from(doc.querySelectorAll('[class*="playerName"], [class*="PlayerName"]'));
    for (const el of allNameEls) {
      const isPlayerTwo = el.classList.toString().includes('playerTwo');
      const name = extractNameFromElement(el);
      if (name) {
        if (isPlayerTwo && !player) {
          player = name;
        } else if (!isPlayerTwo && !opponent) {
          opponent = name;
        }
      }
    }
  }

  return { player, opponent };
}

/**
 * Extracts hero names for both players from their respective Hero Zones.
 */
export function parseHeroNames(doc: Document): { playerHero?: string; opponentHero?: string } {
  let playerHero: string | undefined;
  let opponentHero: string | undefined;

  const playerBoard = doc.querySelector('[class*="PlayerBoardGrid"], [class*="playerBoard"]');
  const opponentBoard = doc.querySelector('[class*="OpponentBoardGrid"], [class*="opponentBoard"]');

  const extractHeroFromContainer = (container: Element | null): string | undefined => {
    if (!container) return undefined;
    const heroZone = container.querySelector('[class*="heroZone"], [class*="HeroZone"]');
    if (!heroZone) return undefined;

    const img = heroZone.querySelector('img');
    if (img) {
      return img.getAttribute('title') || img.getAttribute('alt') || undefined;
    }
    return heroZone.textContent?.trim();
  };

  playerHero = extractHeroFromContainer(playerBoard);
  opponentHero = extractHeroFromContainer(opponentBoard);

  // Fallback: check any hero zone elements across document
  if (!playerHero || !opponentHero) {
    const heroZones = Array.from(doc.querySelectorAll('[class*="heroZone"], [class*="HeroZone"]'));
    if (heroZones.length >= 2) {
      if (!opponentHero) {
        const oppImg = heroZones[0].querySelector('img');
        opponentHero = oppImg?.getAttribute('title') || oppImg?.getAttribute('alt') || heroZones[0].textContent?.trim();
      }
      if (!playerHero) {
        const pImg = heroZones[1].querySelector('img');
        playerHero = pImg?.getAttribute('title') || pImg?.getAttribute('alt') || heroZones[1].textContent?.trim();
      }
    }
  }

  return { playerHero, opponentHero };
}

/**
 * Annotates card pitch colors in chat log messages:
 * Pitch 1 = Vermelha (Red)
 * Pitch 2 = Amarela (Yellow)
 * Pitch 3 = Azul (Blue)
 */
export function annotateMessageCardColors(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;

  // 1. Inspect any card-like elements inside clone
  const cardElements = Array.from(
    clone.querySelectorAll<HTMLElement>(
      '[class*="card"], [class*="Card"], [class*="pitch"], [class*="Pitch"], span, b'
    )
  );

  cardElements.forEach((cardEl) => {
    const classStr = cardEl.className ? cardEl.className.toString().toLowerCase() : '';
    const styleColor = (cardEl.style?.color || cardEl.getAttribute('color') || '').toLowerCase();
    const styleBg = (cardEl.style?.backgroundColor || '').toLowerCase();
    const currentText = cardEl.textContent || '';
    if (!currentText.trim()) return;

    let detectedColor: string | null = null;

    if (
      classStr.includes('pitch1') ||
      classStr.includes('pitch_1') ||
      classStr.includes('_red') ||
      classStr.includes('-red') ||
      /\bred\b/.test(classStr)
    ) {
      detectedColor = 'Vermelha';
    } else if (
      classStr.includes('pitch2') ||
      classStr.includes('pitch_2') ||
      classStr.includes('_yellow') ||
      classStr.includes('-yellow') ||
      /\byellow\b/.test(classStr)
    ) {
      detectedColor = 'Amarela';
    } else if (
      classStr.includes('pitch3') ||
      classStr.includes('pitch_3') ||
      classStr.includes('_blue') ||
      classStr.includes('-blue') ||
      /\bblue\b/.test(classStr)
    ) {
      detectedColor = 'Azul';
    }

    if (!detectedColor) {
      if (
        styleColor.includes('red') ||
        styleColor.includes('rgb(239') ||
        styleColor.includes('rgb(248') ||
        styleColor.includes('#ef') ||
        styleBg.includes('red')
      ) {
        detectedColor = 'Vermelha';
      } else if (
        styleColor.includes('yellow') ||
        styleColor.includes('gold') ||
        styleColor.includes('rgb(234') ||
        styleColor.includes('rgb(245') ||
        styleColor.includes('#eab') ||
        styleColor.includes('#f59')
      ) {
        detectedColor = 'Amarela';
      } else if (
        styleColor.includes('blue') ||
        styleColor.includes('cyan') ||
        styleColor.includes('rgb(59') ||
        styleColor.includes('rgb(14') ||
        styleColor.includes('#3b8')
      ) {
        detectedColor = 'Azul';
      }
    }

    if (!detectedColor) {
      const img = cardEl.querySelector('img');
      const src = img?.getAttribute('src')?.toLowerCase() || '';
      const alt = img?.getAttribute('alt')?.toLowerCase() || '';
      if (src.includes('pitch1') || src.includes('red') || alt.includes('pitch 1') || alt.includes('red')) {
        detectedColor = 'Vermelha';
      } else if (src.includes('pitch2') || src.includes('yellow') || alt.includes('pitch 2') || alt.includes('yellow')) {
        detectedColor = 'Amarela';
      } else if (src.includes('pitch3') || src.includes('blue') || alt.includes('pitch 3') || alt.includes('blue')) {
        detectedColor = 'Azul';
      }
    }

    if (detectedColor) {
      if (
        !currentText.includes('Vermelha') &&
        !currentText.includes('Amarela') &&
        !currentText.includes('Azul') &&
        !currentText.includes('(Red)') &&
        !currentText.includes('(Yellow)') &&
        !currentText.includes('(Blue)')
      ) {
        if (/\(1\)/.test(currentText)) {
          cardEl.textContent = currentText.replace(/\(1\)/, `(1 - ${detectedColor})`);
        } else if (/\(2\)/.test(currentText)) {
          cardEl.textContent = currentText.replace(/\(2\)/, `(2 - ${detectedColor})`);
        } else if (/\(3\)/.test(currentText)) {
          cardEl.textContent = currentText.replace(/\(3\)/, `(3 - ${detectedColor})`);
        } else {
          cardEl.textContent = `${currentText} (${detectedColor})`;
        }
      }
    }
  });

  let raw = clone.textContent?.replace(/\s+/g, ' ').trim() || '';

  // Global pitch number translations: (1) -> (1 - Vermelha), (2) -> (2 - Amarela), (3) -> (3 - Azul)
  raw = raw.replace(/\(1\)(?!\s*-\s*Vermelha)/g, '(1 - Vermelha)');
  raw = raw.replace(/\(2\)(?!\s*-\s*Amarela)/g, '(2 - Amarela)');
  raw = raw.replace(/\(3\)(?!\s*-\s*Azul)/g, '(3 - Azul)');

  return raw;
}

/**
 * Extracts combat log entries from the ChatBox container.
 */
export function parseCombatLogs(doc: Document): string[] {
  const logs: string[] = [];
  const chatBox = doc.querySelector('[class*="chatBox"], [class*="ChatBox"]');
  if (!chatBox) return logs;

  // Select message and turn divider elements
  const elements = Array.from(
    chatBox.querySelectorAll<HTMLElement>(
      '[class*="chatMessage"], [class*="chatMobileMessage"], [class*="turnDivider"], [class*="TurnDivider"], [class*="combatGroupLabel"]'
    )
  ).filter((el) => {
    const className = el.className || '';
    if (typeof className === 'string') {
      // Exclude sub-spans of turnDivider to prevent duplicate partial lines
      if (
        className.includes('turnDividerLabel') ||
        className.includes('turnDividerPlayer') ||
        className.includes('TurnDividerLabel') ||
        className.includes('TurnDividerPlayer')
      ) {
        return false;
      }
    }
    return true;
  });

  if (elements.length > 0) {
    elements.forEach((el) => {
      const className = el.className || '';
      let text = '';
      if (
        typeof className === 'string' &&
        (className.includes('turnDivider') || className.includes('TurnDivider'))
      ) {
        const label = el.querySelector('[class*="turnDividerLabel"], [class*="TurnDividerLabel"]')?.textContent?.trim();
        const player = el.querySelector('[class*="turnDividerPlayer"], [class*="TurnDividerPlayer"]')?.textContent?.trim();
        if (label && player) {
          text = `${label} - ${player}`;
        } else {
          text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
        }
      } else {
        text = annotateMessageCardColors(el);
      }

      if (text.length > 0) {
        logs.push(text);
      }
    });
  } else {
    // Fallback: search leaf message divs if CSS modules classes are obscured
    const fallbackEls = chatBox.querySelectorAll('div > div');
    fallbackEls.forEach((el) => {
      if (el.querySelectorAll('div').length > 0) return;
      const text = annotateMessageCardColors(el as HTMLElement);
      if (text && text.length > 0) {
        logs.push(text);
      }
    });
  }

  return logs;
}

/**
 * Extracts equipped items (head, chest, arms, legs, weapons, off-hand) from both player and opponent boards.
 */
export function parseEquipment(doc: Document): {
  playerEquipment: string[];
  opponentEquipment: string[];
} {
  const extractFromContainer = (container: Element | null): string[] => {
    if (!container) return [];
    const equipNames = new Set<string>();

    const zones = container.querySelectorAll(
      '[class*="equipment"], [class*="Equipment"], [class*="weapon"], [class*="Weapon"], [class*="EquipmentZone"], [class*="heroEquipment"], [class*="head"], [class*="chest"], [class*="arms"], [class*="legs"]'
    );

    // 1. First approach: Look for specific images with the slotImage class anywhere in the container
    const slotImages = Array.from(container.querySelectorAll('img[class*="slotImage"], img[class*="SlotImage"]'));
    slotImages.forEach((img) => {
      const src = img.getAttribute('src');
      if (src) {
        const formatted = formatTalisharCardName(src);
        const lower = formatted.toLowerCase();
        if (formatted && !lower.includes('hero') && !lower.includes('portrait') && !lower.includes('avatar') && !lower.includes('token')) {
          equipNames.add(formatted);
        }
      }
    });

    // 2. Fallback to zones approach
    zones.forEach((zone) => {
      const imgs = zone.querySelectorAll('img');
      imgs.forEach((img) => {
        const title = img.getAttribute('title')?.trim();
        const alt = img.getAttribute('alt')?.trim();
        const src = img.getAttribute('src');

        const candidate = title || alt;
        if (candidate) {
          const lower = candidate.toLowerCase();
          if (!lower.includes('hero') && !lower.includes('portrait') && !lower.includes('avatar') && !lower.includes('token')) {
            equipNames.add(candidate);
          }
        } else if (src) {
          const formatted = formatTalisharCardName(src);
          const lower = formatted.toLowerCase();
          if (formatted && !lower.includes('hero') && !lower.includes('portrait') && !lower.includes('avatar') && !lower.includes('token')) {
            equipNames.add(formatted);
          }
        }
      });

      if (imgs.length === 0) {
        const titleEl = zone.querySelector('[class*="cardName"], [class*="CardName"], [class*="title"], [class*="cardTitle"]');
        if (titleEl && titleEl.textContent?.trim()) {
          const text = titleEl.textContent.trim();
          const lower = text.toLowerCase();
          if (!lower.includes('hero') && !lower.includes('portrait') && !lower.includes('token')) {
            equipNames.add(text);
          }
        }
      }
    });

    return Array.from(equipNames);
  };

  const playerBoard = doc.querySelector('[class*="PlayerBoardGrid"], [class*="playerBoard"]');
  const opponentBoard = doc.querySelector('[class*="OpponentBoardGrid"], [class*="opponentBoard"]');

  let playerEquipment = extractFromContainer(playerBoard);
  let opponentEquipment = extractFromContainer(opponentBoard);

  if (playerEquipment.length === 0 && opponentEquipment.length === 0) {
    const allEquipZones = Array.from(
      doc.querySelectorAll('[class*="equipmentZone"], [class*="EquipmentZone"]')
    );
    if (allEquipZones.length >= 2) {
      opponentEquipment = extractFromContainer(allEquipZones[0]);
      playerEquipment = extractFromContainer(allEquipZones[1]);
    }
  }

  return { playerEquipment, opponentEquipment };
}

/**
 * Detects whether the active tab in the Talishar end game stats is currently showing the opponent.
 */
export function isOpponentTabActive(
  doc: Document,
  opponentNameOrHero?: string,
  playerNameOrHero?: string
): boolean {
  const tabs = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[role="tab"], button[class*="tab"], button[class*="Tab"], [class*="tabButton"], [class*="tab_"], [class*="Tab_"], [class*="tab"], [class*="navItem"]'
    )
  ).filter((t) => {
    const txt = (t.textContent || '').trim().toLowerCase();
    return txt && !txt.includes('close') && !txt.includes('fechar') && !txt.includes('export') && !txt.includes('minimizar');
  });

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const isSelected =
      tab.classList.toString().toLowerCase().includes('active') ||
      tab.classList.toString().toLowerCase().includes('selected') ||
      tab.getAttribute('aria-selected') === 'true';

    if (isSelected) {
      const text = (tab.textContent || '').toLowerCase();
      if (opponentNameOrHero && text.includes(opponentNameOrHero.toLowerCase())) return true;
      if (text.includes('opponent') || text.includes('oponente')) return true;
      if (playerNameOrHero && text.includes(playerNameOrHero.toLowerCase())) return false;
      if (text.includes('you') || text.includes('você') || text.includes('player')) return false;
      if (tabs.length === 2 && i === 1) return true;
    }
  }

  const opponentView = doc.querySelector(
    '[class*="opponentView"][class*="active"], [class*="opponentTab"][class*="active"]'
  );
  return opponentView !== null;
}

/**
 * Finds the clickable tab element for the opponent in the Talishar DOM.
 */
export function findOpponentTabElement(doc: Document, opponentNameOrHero?: string): HTMLElement | null {
  const tabs = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[role="tab"], button[class*="tab"], button[class*="Tab"], [class*="tab_"], [class*="Tab_"], [class*="tabButton"], [class*="tab"], [class*="navItem"], button'
    )
  );

  const candidateTabs = tabs.filter((t) => {
    const txt = (t.textContent || '').trim().toLowerCase();
    if (!txt) return false;
    if (txt.includes('close') || txt.includes('fechar') || txt.includes('chat') || txt.includes('export') || txt.includes('salvar') || txt.includes('minimizar')) {
      return false;
    }
    return true;
  });

  // 1. Look for text matching opponent name or hero or "opponent"
  for (const tab of candidateTabs) {
    const text = (tab.textContent || '').trim().toLowerCase();
    if (opponentNameOrHero && text.includes(opponentNameOrHero.toLowerCase())) return tab;
    if (text.includes('opponent') || text.includes('oponente')) return tab;
  }

  // 2. If exactly two candidate tabs (Player vs Opponent), return the second one
  if (candidateTabs.length === 2) {
    return candidateTabs[1];
  }

  return null;
}

/**
 * Extracts Average Turn Value metrics displayed by Talishar for both players.
 */
export function parseAverageTurnValues(
  doc: Document,
  opponentNameOrHero?: string,
  playerNameOrHero?: string,
  knownPlayerAvg?: number
): {
  playerAvgTurnValue?: number;
  opponentAvgTurnValue?: number;
} {
  let playerAvgTurnValue: number | undefined;
  let opponentAvgTurnValue: number | undefined;

  const opponentActive = isOpponentTabActive(doc, opponentNameOrHero, playerNameOrHero);

  // 1. Direct check on all elements matching [class*="infoValue"] (e.g. _infoValue_1fs3u_152)
  const infoValues = Array.from(
    doc.querySelectorAll<HTMLElement>('[class*="infoValue"], [class*="InfoValue"]')
  );
  for (const valEl of infoValues) {
    const text = valEl.textContent || '';
    const parentRow = valEl.closest('[class*="infoRow"], [class*="InfoRow"], tr, div, li');
    const rowText = parentRow ? parentRow.textContent || '' : '';

    if (/Avg Value per Turn|Average Value per Turn|Valor M[eé]dio por Turno/i.test(rowText)) {
      const numMatch = text.match(/(\d+(?:[.,]\d+)?)/);
      if (numMatch) {
        const val = parseFloat(numMatch[1].replace(',', '.'));
        if (!isNaN(val)) {
          const isExplicitPlayer =
            /Player Avg|My Avg|Meu Valor/i.test(rowText) ||
            (parentRow && parentRow.closest('.playerStats, [class*="playerBoard"]') !== null);

          const isExplicitOpponent =
            /Opponent|Oponente/i.test(rowText) ||
            (parentRow && parentRow.closest('.opponentStats, [class*="opponentBoard"]') !== null);

          let rowIsOpponent = false;
          if (isExplicitPlayer) {
            rowIsOpponent = false;
          } else if (isExplicitOpponent) {
            rowIsOpponent = true;
          } else if (opponentActive) {
            rowIsOpponent = true;
          } else if (
            knownPlayerAvg !== undefined &&
            !isNaN(knownPlayerAvg) &&
            Math.abs(val - knownPlayerAvg) > 0.05
          ) {
            rowIsOpponent = true;
          }

          if (rowIsOpponent && opponentAvgTurnValue === undefined) {
            opponentAvgTurnValue = val;
          } else if (!rowIsOpponent && playerAvgTurnValue === undefined) {
            playerAvgTurnValue = val;
          }
        }
      }
    }
  }

  // 2. Fallback query specific info row elements or small elements
  if (playerAvgTurnValue === undefined && opponentAvgTurnValue === undefined) {
    const candidates = Array.from(
      doc.querySelectorAll('[class*="infoRow"], [class*="InfoRow"], tr, [class*="statRow"]')
    );
    const rows = candidates.length > 0 ? candidates : Array.from(doc.querySelectorAll('div, li, p'));

    for (const row of rows) {
      if (candidates.length > 0 && row.querySelectorAll('[class*="infoRow"], [class*="InfoRow"]').length > 0) {
        continue;
      }

      const text = row.textContent || '';
      if (/Avg Value per Turn|Average Value per Turn|Valor M[eé]dio por Turno/i.test(text)) {
        const isExplicitPlayer =
          /Player Avg|My Avg|Meu Valor/i.test(text) ||
          row.closest('.playerStats, [class*="playerBoard"]') !== null;

        const isExplicitOpponent =
          /Opponent|Oponente/i.test(text) ||
          row.closest('.opponentStats, [class*="opponentBoard"]') !== null;

        let rowIsOpponent = false;
        if (isExplicitPlayer) {
          rowIsOpponent = false;
        } else if (isExplicitOpponent) {
          rowIsOpponent = true;
        } else if (opponentActive) {
          rowIsOpponent = true;
        }

        const valueSpan = row.querySelector('[class*="infoValue"], [class*="InfoValue"]');
        const textToExtract = valueSpan ? valueSpan.textContent || '' : text;
        const numMatch = textToExtract.match(/(\d+(?:[.,]\d+)?)/);
        if (numMatch) {
          const val = parseFloat(numMatch[1].replace(',', '.'));
          if (!isNaN(val)) {
            if (
              !rowIsOpponent &&
              knownPlayerAvg !== undefined &&
              !isNaN(knownPlayerAvg) &&
              Math.abs(val - knownPlayerAvg) > 0.05
            ) {
              rowIsOpponent = true;
            }

            if (rowIsOpponent && opponentAvgTurnValue === undefined) {
              opponentAvgTurnValue = val;
            } else if (!rowIsOpponent && playerAvgTurnValue === undefined) {
              playerAvgTurnValue = val;
            }
          }
        }
      }
    }
  }

  return { playerAvgTurnValue, opponentAvgTurnValue };
}

/**
 * Determines the match result (win/loss/draw) from victory or defeat indicators.
 */
export function parseMatchResult(doc: Document): MatchResult {
  const victoryEl = doc.querySelector('[class*="outcomeVictory"], [class*="OutcomeVictory"]');
  if (victoryEl) return 'win';

  const defeatEl = doc.querySelector('[class*="outcomeDefeat"], [class*="OutcomeDefeat"]');
  if (defeatEl) return 'loss';

  // Fallback to text searching in game dialogs or end screen
  const endContainer = doc.querySelector('[class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"]');
  if (endContainer) {
    const text = (endContainer.textContent || '').toUpperCase();
    if (text.includes('VICTORY') || text.includes('YOU WIN')) return 'win';
    if (text.includes('DEFEAT') || text.includes('YOU LOSE')) return 'loss';
  }

  return 'unknown';
}

/**
 * Calculates total turns played from log dividers or text messages.
 */
export function parseTurnCount(doc: Document, logs: string[]): number {
  let maxTurn = 0;

  for (const line of logs) {
    const match = line.match(/Turn\s+(\d+)/i);
    if (match) {
      const turnNo = parseInt(match[1], 10);
      if (!isNaN(turnNo) && turnNo > maxTurn) {
        maxTurn = turnNo;
      }
    }
  }

  if (maxTurn > 0) return maxTurn;

  // Fallback: count TurnDivider elements in DOM
  const dividers = doc.querySelectorAll('[class*="turnDivider"], [class*="TurnDivider"]');
  return dividers.length > 0 ? dividers.length : 1;
}

/**
 * Determines if the player went first (turn 1) based on the combat logs.
 */
export function parseWentFirst(logs: string[], playerName?: string, opponentName?: string): boolean | undefined {
  if (!logs || logs.length === 0) return undefined;

  for (const line of logs) {
    if (/Turn\s*1/i.test(line)) {
      if (playerName && line.toLowerCase().includes(playerName.toLowerCase())) {
        return true;
      }
      if (opponentName && line.toLowerCase().includes(opponentName.toLowerCase())) {
        return false;
      }
    }
  }
  return undefined;
}

/**
 * Identifies the turn with the most damage dealt for each player based on combat logs.
 */
export function parseMaxDamageTurn(logs: string[], playerName?: string, opponentName?: string): { playerMaxDamage: number, playerMaxDamageTurn: number, opponentMaxDamage: number, opponentMaxDamageTurn: number } {
  let playerMax = 0;
  let playerMaxTurn = 0;
  let opponentMax = 0;
  let opponentMaxTurn = 0;

  let currentTurn = 0;
  let currentPlayerDamage = 0;
  let currentOpponentDamage = 0;

  const pushTurnResults = () => {
    if (currentPlayerDamage > playerMax) {
      playerMax = currentPlayerDamage;
      playerMaxTurn = currentTurn;
    }
    if (currentOpponentDamage > opponentMax) {
      opponentMax = currentOpponentDamage;
      opponentMaxTurn = currentTurn;
    }
  };

  for (const line of logs) {
    const turnMatch = line.match(/Turn\s+(\d+)/i);
    if (turnMatch) {
      pushTurnResults();
      currentTurn = parseInt(turnMatch[1], 10);
      currentPlayerDamage = 0;
      currentOpponentDamage = 0;
      continue;
    }

    // Typical combat log for damage: "X takes Y damage" or "Z deals Y damage"
    // Examples:
    // "OpponentName takes 5 damage" => Opponent took 5 damage, Player dealt 5 damage.
    // "PlayerName takes 3 damage" => Player took 3 damage, Opponent dealt 3 damage.
    const dmgMatch = line.match(/takes (\d+) damage/i) || line.match(/deals (\d+) damage/i);
    if (dmgMatch) {
      const dmg = parseInt(dmgMatch[1], 10);
      if (!isNaN(dmg)) {
        const isPlayerTaking = playerName && line.toLowerCase().includes(playerName.toLowerCase());
        const isOpponentTaking = opponentName && line.toLowerCase().includes(opponentName.toLowerCase());
        
        // If "takes", the person mentioned is receiving damage. 
        // If "deals", the person mentioned is dealing damage.
        const isTakes = /takes/i.test(line);

        if (isTakes) {
          if (isOpponentTaking) {
            currentPlayerDamage += dmg;
          } else if (isPlayerTaking) {
            currentOpponentDamage += dmg;
          }
        } else {
          // It's "deals"
          if (isPlayerTaking) {
            currentPlayerDamage += dmg;
          } else if (isOpponentTaking) {
            currentOpponentDamage += dmg;
          }
        }
      }
    }
  }
  pushTurnResults(); // flush last turn

  return {
    playerMaxDamage: playerMax,
    playerMaxDamageTurn: playerMaxTurn,
    opponentMaxDamage: opponentMax,
    opponentMaxDamageTurn: opponentMaxTurn
  };
}

/**
 * Parses fatigue (cards left in deck) from the DOM.
 */
export function parseFatigue(doc: Document): { playerFatigue?: number, opponentFatigue?: number } {
  const getDeckCount = (container: Element | null): number | undefined => {
    if (!container) return undefined;
    const countEl = container.querySelector('[class*="deckCount"], [class*="DeckCount"], [class*="deckSize"], [class*="badge"], [class*="count"]');
    if (countEl && countEl.textContent) {
      const val = parseInt(countEl.textContent.trim(), 10);
      if (!isNaN(val)) return val;
    }
    return undefined;
  };

  const playerBoard = doc.querySelector('[class*="PlayerBoardGrid"], [class*="playerBoard"]');
  const opponentBoard = doc.querySelector('[class*="OpponentBoardGrid"], [class*="opponentBoard"]');

  return {
    playerFatigue: getDeckCount(playerBoard),
    opponentFatigue: getDeckCount(opponentBoard),
  };
}

/**
 * Extracts a complete MatchRecord snapshot from the current DOM state.
 */
export function extractMatchRecordFromDom(doc: Document = document): Partial<MatchRecord> {
  const { player: playerName, opponent: oppName } = parsePlayerNames(doc);
  const { playerHero, opponentHero } = parseHeroNames(doc);
  const rawLogs = parseCombatLogs(doc);
  const turnsCount = parseTurnCount(doc, rawLogs);
  const result = parseMatchResult(doc);
  const wentFirst = parseWentFirst(rawLogs, playerName, oppName);
  const { playerAvgTurnValue, opponentAvgTurnValue } = parseAverageTurnValues(
    doc,
    oppName || opponentHero,
    playerName || playerHero
  );
  const { playerEquipment, opponentEquipment } = parseEquipment(doc);
  const { playerFatigue, opponentFatigue } = parseFatigue(doc);
  const { playerMaxDamage, playerMaxDamageTurn, opponentMaxDamage, opponentMaxDamageTurn } = parseMaxDamageTurn(rawLogs, playerName, oppName);

  const player: PlayerStats = {
    name: playerName || 'Jogador',
    hero: playerHero || '-',
    avgTurnValue: playerAvgTurnValue,
    fatigue: playerFatigue,
    maxDamage: playerMaxDamage,
    maxDamageTurn: playerMaxDamageTurn
  };

  const opponent: PlayerStats = {
    name: oppName || 'Oponente',
    hero: opponentHero || '-',
    avgTurnValue: opponentAvgTurnValue,
    fatigue: opponentFatigue,
    maxDamage: opponentMaxDamage,
    maxDamageTurn: opponentMaxDamageTurn
  };

  return {
    id: `talishar-${Date.now()}`,
    timestamp: new Date().toISOString(),
    player,
    opponent,
    result,
    turnsCount,
    rawLogs,
    playerEquipment,
    opponentEquipment,
    format: 'CC',
    wentFirst,
    platform: 'Talishar',
  };
}
