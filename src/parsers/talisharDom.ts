import type { MatchRecord, MatchResult, PlayerStats } from '../types/match';

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
 * Extracts combat log entries from the ChatBox container.
 */
export function parseCombatLogs(doc: Document): string[] {
  const logs: string[] = [];
  const chatBox = doc.querySelector('[class*="chatBox"], [class*="ChatBox"]');
  if (!chatBox) return logs;

  // Select message and turn divider elements
  const elements = chatBox.querySelectorAll(
    '[class*="turnDivider"], [class*="TurnDivider"], div > div, p, [class*="combatGroup"]'
  );

  elements.forEach((el) => {
    // Only capture direct leaf or meaningful log lines
    if (el.children.length === 0 || el.classList.toString().toLowerCase().includes('turndivider')) {
      const text = el.textContent?.trim();
      if (text && !logs.includes(text)) {
        logs.push(text);
      }
    }
  });

  return logs;
}

/**
 * Extracts Average Turn Value metrics displayed by Talishar for both players.
 */
export function parseAverageTurnValues(doc: Document): {
  playerAvgTurnValue?: number;
  opponentAvgTurnValue?: number;
} {
  let playerAvgTurnValue: number | undefined;
  let opponentAvgTurnValue: number | undefined;

  // Query specific info row elements or small elements
  const candidates = Array.from(
    doc.querySelectorAll('[class*="infoRow"], [class*="InfoRow"], tr, [class*="statRow"]')
  );

  const rows = candidates.length > 0 ? candidates : Array.from(doc.querySelectorAll('div, li, p'));

  for (const row of rows) {
    // If candidates exist, skip elements that contain other infoRow elements to avoid parent matching
    if (candidates.length > 0 && row.querySelectorAll('[class*="infoRow"], [class*="InfoRow"]').length > 0) {
      continue;
    }

    const text = row.textContent || '';
    if (/Avg Value per Turn|Average Value per Turn|Valor M[eé]dio por Turno/i.test(text)) {
      const isOpponent =
        /Opponent|Oponente/i.test(text) || row.closest('.opponentStats, [class*="opponent"]') !== null;
      
      const valueSpan = row.querySelector('[class*="infoValue"], [class*="InfoValue"]');
      const textToExtract = valueSpan ? valueSpan.textContent || '' : text;
      const numMatch = textToExtract.match(/(\d+(?:[.,]\d+)?)/);
      if (numMatch) {
        const val = parseFloat(numMatch[1].replace(',', '.'));
        if (!isNaN(val)) {
          if (isOpponent && opponentAvgTurnValue === undefined) {
            opponentAvgTurnValue = val;
          } else if (!isOpponent && playerAvgTurnValue === undefined) {
            playerAvgTurnValue = val;
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
 * Extracts a complete MatchRecord snapshot from the current DOM state.
 */
export function extractMatchRecordFromDom(doc: Document = document): Partial<MatchRecord> {
  const { player: playerName, opponent: oppName } = parsePlayerNames(doc);
  const { playerHero, opponentHero } = parseHeroNames(doc);
  const rawLogs = parseCombatLogs(doc);
  const turnsCount = parseTurnCount(doc, rawLogs);
  const result = parseMatchResult(doc);
  const { playerAvgTurnValue, opponentAvgTurnValue } = parseAverageTurnValues(doc);

  const player: PlayerStats = {
    name: playerName || 'Jogador',
    hero: playerHero || '-',
    avgTurnValue: playerAvgTurnValue,
  };

  const opponent: PlayerStats = {
    name: oppName || 'Oponente',
    hero: opponentHero || '-',
    avgTurnValue: opponentAvgTurnValue,
  };

  return {
    id: `talishar-${Date.now()}`,
    timestamp: new Date().toISOString(),
    player,
    opponent,
    result,
    turnsCount,
    rawLogs,
  };
}
