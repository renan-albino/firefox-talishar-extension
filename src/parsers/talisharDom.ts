import type { MatchRecord, MatchResult, PlayerStats } from '../types/match';
import { formatTalisharCardName } from './sideboardTracker';

/**
 * Extracts player and opponent usernames from the Talishar DOM.
 */
export function parsePlayerNames(doc: Document): {
  player?: string;
  opponent?: string;
  playerUsername?: string;
  opponentUsername?: string;
} {
  let player: string | undefined;
  let opponent: string | undefined;
  let playerUsername: string | undefined;
  let opponentUsername: string | undefined;

  const extractCleanName = (el: Element | null): string | undefined => {
    if (!el) return undefined;
    const nameSpan = el.querySelector('[class*="name"]:not([class*="nameContent"]):not([class*="nameContainer"])');
    if (nameSpan && nameSpan.textContent?.trim()) {
      return nameSpan.textContent.trim();
    }
    const nameContent = el.querySelector('[class*="nameContent"], [class*="NameContent"]');
    if (nameContent && nameContent.textContent?.trim()) {
      return nameContent.textContent.trim();
    }
    return el.textContent?.trim();
  };

  // 1. From Player vs Opponent board containers
  const playerBoard = doc.querySelector('[class*="PlayerBoardGrid"], [class*="playerBoard"]');
  const opponentBoard = doc.querySelector('[class*="OpponentBoardGrid"], [class*="opponentBoard"]');

  if (playerBoard) {
    player = extractCleanName(playerBoard.querySelector('[class*="playerName"], [class*="PlayerName"]'));
    if (player) playerUsername = player;
  }

  if (opponentBoard) {
    opponent = extractCleanName(opponentBoard.querySelector('[class*="playerName"], [class*="PlayerName"]'));
    if (opponent) opponentUsername = opponent;
  }

  // 2. From LeftColumn elements (PlayerName.tsx): player has class 'playerTwo', opponent does not
  if (!player || !opponent) {
    const allNameEls = Array.from(doc.querySelectorAll('[class*="playerName"], [class*="PlayerName"]'));
    for (const el of allNameEls) {
      const cls = (el.className || '').toLowerCase();
      const isPlayerTwo = cls.includes('playertwo');
      const name = extractCleanName(el);
      if (name) {
        if (isPlayerTwo && !player) {
          player = name;
          playerUsername = name;
        } else if (!isPlayerTwo && !opponent) {
          opponent = name;
          opponentUsername = name;
        }
      }
    }
  }

  // 3. Fallback: discover usernames from Turn Dividers in chatBox (e.g. "Turn 1 - akiles185")
  if (!playerUsername || !opponentUsername) {
    const turnDividerPlayers = Array.from(doc.querySelectorAll('[class*="turnDividerPlayer"], [class*="TurnDividerPlayer"]'))
      .map((el) => el.textContent?.trim())
      .filter((n): n is string => Boolean(n && n.length > 1 && !['player', 'opponent', 'setup', 'game'].includes(n.toLowerCase())));

    if (turnDividerPlayers.length > 0) {
      const distinct = Array.from(new Set(turnDividerPlayers));
      if (!playerUsername && distinct[0]) {
        playerUsername = distinct[0];
        if (!player) player = distinct[0];
      }
      if (!opponentUsername && distinct[1]) {
        opponentUsername = distinct[1];
        if (!opponent) opponent = distinct[1];
      }
    }
  }

  return { player, opponent, playerUsername, opponentUsername };
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

    let detectedPitch: 'r' | 'y' | 'b' | null = null;

    if (
      classStr.includes('pitch1') ||
      classStr.includes('pitch_1') ||
      classStr.includes('_red') ||
      classStr.includes('-red') ||
      /\bred\b/.test(classStr)
    ) {
      detectedPitch = 'r';
    } else if (
      classStr.includes('pitch2') ||
      classStr.includes('pitch_2') ||
      classStr.includes('_yellow') ||
      classStr.includes('-yellow') ||
      /\byellow\b/.test(classStr)
    ) {
      detectedPitch = 'y';
    } else if (
      classStr.includes('pitch3') ||
      classStr.includes('pitch_3') ||
      classStr.includes('_blue') ||
      classStr.includes('-blue') ||
      /\bblue\b/.test(classStr)
    ) {
      detectedPitch = 'b';
    }

    if (!detectedPitch) {
      if (
        styleColor.includes('red') ||
        styleColor.includes('rgb(239') ||
        styleColor.includes('rgb(248') ||
        styleColor.includes('#ef') ||
        styleBg.includes('red')
      ) {
        detectedPitch = 'r';
      } else if (
        styleColor.includes('yellow') ||
        styleColor.includes('gold') ||
        styleColor.includes('rgb(234') ||
        styleColor.includes('rgb(245') ||
        styleColor.includes('#eab') ||
        styleColor.includes('#f59')
      ) {
        detectedPitch = 'y';
      } else if (
        styleColor.includes('blue') ||
        styleColor.includes('cyan') ||
        styleColor.includes('rgb(59') ||
        styleColor.includes('rgb(14') ||
        styleColor.includes('#3b8')
      ) {
        detectedPitch = 'b';
      }
    }

    if (!detectedPitch) {
      const img = cardEl.querySelector('img');
      const src = img?.getAttribute('src')?.toLowerCase() || '';
      const alt = img?.getAttribute('alt')?.toLowerCase() || '';
      if (src.includes('pitch1') || src.includes('red') || alt.includes('pitch 1') || alt.includes('red')) {
        detectedPitch = 'r';
      } else if (src.includes('pitch2') || src.includes('yellow') || alt.includes('pitch 2') || alt.includes('yellow')) {
        detectedPitch = 'y';
      } else if (src.includes('pitch3') || src.includes('blue') || alt.includes('pitch 3') || alt.includes('blue')) {
        detectedPitch = 'b';
      }
    }

    if (detectedPitch) {
      if (
        !/\([ryb]\)/i.test(currentText) &&
        !/\((?:Red|Yellow|Blue|Vermelha|Amarela|Azul)\)/i.test(currentText)
      ) {
        if (/\([123]\)/.test(currentText)) {
          cardEl.textContent = currentText.replace(/\([123]\)/, `(${detectedPitch})`);
        } else {
          cardEl.textContent = `${currentText} (${detectedPitch})`;
        }
      }
    }
  });

  let raw = clone.textContent?.replace(/\s+/g, ' ').trim() || '';

  // Global pitch translations to concise community standard: (r), (y), (b)
  raw = raw
    .replace(/\(1\s*-\s*Vermelha\)/gi, '(r)')
    .replace(/\(2\s*-\s*Amarela\)/gi, '(y)')
    .replace(/\(3\s*-\s*Azul\)/gi, '(b)')
    .replace(/\(Red\)/gi, '(r)')
    .replace(/\(Yellow\)/gi, '(y)')
    .replace(/\(Blue\)/gi, '(b)')
    .replace(/\(Vermelha\)/gi, '(r)')
    .replace(/\(Amarela\)/gi, '(y)')
    .replace(/\(Azul\)/gi, '(b)')
    .replace(/\(1\)/g, '(r)')
    .replace(/\(2\)/g, '(y)')
    .replace(/\(3\)/g, '(b)');

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

  let currentChainLink = 0;

  if (elements.length > 0) {
    elements.forEach((el) => {
      const className = el.className || '';
      let text = '';
      if (
        typeof className === 'string' &&
        (className.includes('turnDivider') || className.includes('TurnDivider'))
      ) {
        currentChainLink = 0;
        const label = el.querySelector('[class*="turnDividerLabel"], [class*="TurnDividerLabel"]')?.textContent?.trim();
        const player = el.querySelector('[class*="turnDividerPlayer"], [class*="TurnDividerPlayer"]')?.textContent?.trim();
        if (label && player) {
          text = `--- ${label} - ${player} ---`;
        } else {
          const raw = el.textContent?.replace(/\s+/g, ' ').trim() || '';
          text = raw.startsWith('---') ? raw : `--- ${raw} ---`;
        }
      } else if (
        typeof className === 'string' &&
        className.includes('combatGroupLabel')
      ) {
        text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
        const linkMatch = text.match(/chain\s*link\s*(\d+)/i);
        if (linkMatch) {
          currentChainLink = parseInt(linkMatch[1], 10);
        }
      } else {
        text = annotateMessageCardColors(el);
        if (/combat chain was closed/i.test(text)) {
          currentChainLink = 0;
        } else if (
          /played\s+.+?\s+for\s+\d+/i.test(text) ||
          /attacks?\s+with/i.test(text) ||
          /attacked?\s+with/i.test(text)
        ) {
          if (!/chain\s*link/i.test(text)) {
            currentChainLink++;
            text = `[Chain Link ${currentChainLink}] ${text}`;
          }
        }
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
      let text = annotateMessageCardColors(el as HTMLElement);
      if (text && text.length > 0) {
        if (/turn\s*\d+/i.test(text) && !text.includes('---')) {
          currentChainLink = 0;
          text = `--- ${text} ---`;
        } else if (/combat chain was closed/i.test(text)) {
          currentChainLink = 0;
        } else if (
          /played\s+.+?\s+for\s+\d+/i.test(text) ||
          /attacks?\s+with/i.test(text) ||
          /attacked?\s+with/i.test(text)
        ) {
          if (!/chain\s*link/i.test(text)) {
            currentChainLink++;
            text = `[Chain Link ${currentChainLink}] ${text}`;
          }
        }
        logs.push(text);
      }
    });
  }

  return logs;
}

/**
 * Extracts equipped items (head, chest, arms, legs, weapons, off-hand) from both player and opponent boards.
 */
/**
 * Extracts equipped items (head, chest, arms, legs, weapons, off-hand) from both player and opponent boards.
 */
export function parseEquipment(
  doc: Document,
  cachedPlayerEquipment?: string[],
  cachedOpponentEquipment?: string[]
): {
  playerEquipment: string[];
  opponentEquipment: string[];
} {
  const extractEquipmentFromContainer = (container: Element | null): string[] => {
    if (!container) return [];
    const equipNames = new Set<string>();

    const imgs = Array.from(container.querySelectorAll('img'));
    imgs.forEach((img) => {
      const alt = img.getAttribute('alt')?.trim();
      const title = img.getAttribute('title')?.trim();
      const src = img.getAttribute('src') || '';

      const candidate = alt || title || src;
      if (candidate) {
        const formatted = formatTalisharCardName(candidate);
        const lower = formatted.toLowerCase();
        if (
          formatted &&
          !lower.includes('hero') &&
          !lower.includes('portrait') &&
          !lower.includes('avatar') &&
          !lower.includes('token') &&
          !lower.includes('playmat') &&
          !lower.includes('difficulties') &&
          !lower.includes('back')
        ) {
          equipNames.add(formatted);
        }
      }
    });

    return Array.from(equipNames);
  };

  const pEquip = new Set<string>();
  const oEquip = new Set<string>();

  // 1. Desktop GridBoard zones (Player 1 = pOne..., Player 2 = pTwo...)
  const pOneZones = Array.from(
    doc.querySelectorAll(
      '[class*="pOneHead"], [class*="pOneChest"], [class*="pOneHands"], [class*="pOneLegs"], [class*="pOneWeaponLZone"], [class*="pOneWeaponRZone"]'
    )
  );
  pOneZones.forEach((zone) => {
    extractEquipmentFromContainer(zone).forEach((item) => pEquip.add(item));
  });

  const pTwoZones = Array.from(
    doc.querySelectorAll(
      '[class*="pTwoHead"], [class*="pTwoChest"], [class*="pTwoHands"], [class*="pTwoLegs"], [class*="pTwoWeaponLZone"], [class*="pTwoWeaponRZone"]'
    )
  );
  pTwoZones.forEach((zone) => {
    extractEquipmentFromContainer(zone).forEach((item) => oEquip.add(item));
  });

  // 2. Mobile/portrait PlayerBoardGrid & OpponentBoardGrid fallback
  if (pEquip.size === 0) {
    const playerBoard = doc.querySelector('[class*="PlayerBoardGrid"], [class*="playerBoard"]');
    if (playerBoard) {
      const pZones = Array.from(
        playerBoard.querySelectorAll(
          '[class*="headZone"], [class*="chestZone"], [class*="armsZone"], [class*="legsZone"], [class*="weaponLZone"], [class*="weaponRZone"], [class*="equipZone"], [class*="equipment"], [class*="Equipment"], [class*="weapon"], [class*="Weapon"], [class*="head"], [class*="chest"], [class*="arms"], [class*="legs"]'
        )
      );
      pZones.forEach((zone) => {
        extractEquipmentFromContainer(zone).forEach((item) => pEquip.add(item));
      });
      if (pEquip.size === 0) {
        extractEquipmentFromContainer(playerBoard).forEach((item) => pEquip.add(item));
      }
    }
  }

  if (oEquip.size === 0) {
    const oppBoard = doc.querySelector('[class*="OpponentBoardGrid"], [class*="opponentBoard"]');
    if (oppBoard) {
      const oZones = Array.from(
        oppBoard.querySelectorAll(
          '[class*="headZone"], [class*="chestZone"], [class*="armsZone"], [class*="legsZone"], [class*="weaponLZone"], [class*="weaponRZone"], [class*="equipZone"], [class*="equipment"], [class*="Equipment"], [class*="weapon"], [class*="Weapon"], [class*="head"], [class*="chest"], [class*="arms"], [class*="legs"]'
        )
      );
      oZones.forEach((zone) => {
        extractEquipmentFromContainer(zone).forEach((item) => oEquip.add(item));
      });
      if (oEquip.size === 0) {
        extractEquipmentFromContainer(oppBoard).forEach((item) => oEquip.add(item));
      }
    }
  }

  // 3. Fallback: Check all equipmentZone elements across doc
  if (pEquip.size === 0 && oEquip.size === 0) {
    const allEquipZones = Array.from(
      doc.querySelectorAll('[class*="equipmentZone"], [class*="EquipmentZone"], [class*="equipZone"]')
    );
    if (allEquipZones.length >= 2) {
      extractEquipmentFromContainer(allEquipZones[0]).forEach((item) => oEquip.add(item));
      extractEquipmentFromContainer(allEquipZones[1]).forEach((item) => pEquip.add(item));
    }
  }

  // 4. Fallback to cached equipment from during-game state
  if (pEquip.size === 0 && cachedPlayerEquipment && cachedPlayerEquipment.length > 0) {
    cachedPlayerEquipment.forEach((item) => pEquip.add(item));
  }
  if (oEquip.size === 0 && cachedOpponentEquipment && cachedOpponentEquipment.length > 0) {
    cachedOpponentEquipment.forEach((item) => oEquip.add(item));
  }

  return {
    playerEquipment: Array.from(pEquip),
    opponentEquipment: Array.from(oEquip),
  };
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
 * Locates all "Exclude Last Turn" checkboxes in the Talishar end-game stats modal.
 */
export function findAllExcludeLastTurnCheckboxes(doc: Document = document): HTMLInputElement[] {
  const byClass = Array.from(
    doc.querySelectorAll<HTMLInputElement>(
      'input[class*="excludeLastTurn"], input[class*="ExcludeLastTurn"], input[type="checkbox"][class*="exclude"]'
    )
  );
  if (byClass.length > 0) return byClass;
  return Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter((cb) => {
    const parentText = cb.closest('label, div, p, span, tr')?.textContent?.toLowerCase() || '';
    return parentText.includes('exclude last turn') || parentText.includes('last turn');
  });
}

/**
 * Locates the "Exclude Last Turn" checkbox in the Talishar end-game stats modal.
 */
export function findExcludeLastTurnCheckbox(doc: Document = document): HTMLInputElement | null {
  const all = findAllExcludeLastTurnCheckboxes(doc);
  return all.length > 0 ? all[0] : null;
}

/**
 * Ensures all "Exclude Last Turn" checkboxes in the document are checked.
 * Dispatches click, change, and input events to reliably notify React.
 */
export async function ensureExcludeLastTurnChecked(
  doc: Document = document,
  waitMs: number = 350
): Promise<boolean> {
  const checkboxes = findAllExcludeLastTurnCheckboxes(doc);
  let clickedAny = false;

  for (const cb of checkboxes) {
    if (!cb.checked) {
      try {
        if (typeof cb.click === 'function') {
          cb.click();
        } else {
          cb.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        cb.dispatchEvent(new Event('input', { bubbles: true }));
        clickedAny = true;
      } catch (e) {
        console.warn('[Talishar Log Exporter] Falha ao marcar excludeLastTurn:', e);
      }
    }
  }

  if (clickedAny) {
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return clickedAny;
}

/**
 * Locates the "Switch Player Stats" button in the Talishar end-game stats modal.
 */
export function findSwitchPlayerStatsButton(doc: Document = document): HTMLElement | null {
  const elements = Array.from(
    doc.querySelectorAll<HTMLElement>(
      'button, div[class*="buttonDiv"], div[role="button"], span[class*="button"], a[role="button"]'
    )
  );
  return (
    elements.find((b) => {
      const txt = b.textContent?.trim().toLowerCase() || '';
      return (
        txt.includes('switch player stats') ||
        txt.includes('switch player') ||
        b.classList.toString().toLowerCase().includes('switchplayer') ||
        b.querySelector('path[d*="M0 168v-16"]') !== null
      );
    }) || null
  );
}

/**
 * Automatically captures end-game stats by:
 * 1. Ensuring "Exclude Last Turn" checkbox is clicked/checked FIRST before reading any stats.
 * 2. Reading current stats.
 * 3. Clicking "Switch Player Stats" to read opponent stats.
 * 4. Clicking "Switch Player Stats" again to return the user to their own view.
 */
export async function autoCaptureEndGameStats(
  doc: Document = document,
  options?: {
    opponentNameOrHero?: string;
    playerNameOrHero?: string;
    waitMs?: number;
  }
): Promise<{
  playerAvgTurnValue?: number;
  opponentAvgTurnValue?: number;
}> {
  const waitTime = options?.waitMs ?? 350;

  // 1. Ensure "Exclude Last Turn" checkbox is clicked/checked FIRST before reading any stats
  await ensureExcludeLastTurnChecked(doc, waitTime);

  // 2. Read initial stats from the current view (with checkbox checked)
  const isOppActive = isOpponentTabActive(doc, options?.opponentNameOrHero, options?.playerNameOrHero);
  const initialStats = parseAverageTurnValues(doc, options?.opponentNameOrHero, options?.playerNameOrHero);
  const initialVal = initialStats.playerAvgTurnValue ?? initialStats.opponentAvgTurnValue;

  let playerAvg = isOppActive ? undefined : initialVal;
  let oppAvg = isOppActive ? initialVal : initialStats.opponentAvgTurnValue;

  // 3. Find and toggle "Switch Player Stats" button
  const switchBtn = findSwitchPlayerStatsButton(doc);
  if (switchBtn) {
    const triggerClick = (el: HTMLElement) => {
      if (typeof el.click === 'function') {
        el.click();
      } else {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    };

    try {
      // Switch view to opposite player
      triggerClick(switchBtn);
      await new Promise((r) => setTimeout(r, waitTime + 80));

      // Also ensure excludeLastTurn is checked on the switched view if separate
      await ensureExcludeLastTurnChecked(doc, waitTime);

      // Read stats from the switched view
      const switchedStats = parseAverageTurnValues(doc, options?.opponentNameOrHero, options?.playerNameOrHero);
      const switchedVal = switchedStats.playerAvgTurnValue ?? switchedStats.opponentAvgTurnValue;

      if (isOppActive) {
        if (switchedVal !== undefined) playerAvg = switchedVal;
      } else {
        if (switchedVal !== undefined) oppAvg = switchedVal;
      }
    } catch (e) {
      console.warn('[Talishar Log Exporter] Erro ao alternar Switch Player Stats:', e);
    } finally {
      // Always switch back so user view remains unchanged
      try {
        triggerClick(switchBtn);
        await new Promise((r) => setTimeout(r, waitTime));
      } catch {}
    }
  }

  return {
    playerAvgTurnValue: playerAvg,
    opponentAvgTurnValue: oppAvg,
  };
}

/**
 * Checks if a card name corresponds to equipment, weapon or shield.
 */
export function isEquipmentOrWeapon(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('raydn') ||
    lower.includes('duskbane') ||
    lower.includes('circlet') ||
    lower.includes('helm') ||
    lower.includes('kabuto') ||
    lower.includes('warband') ||
    lower.includes('tunic') ||
    lower.includes('soulbond') ||
    lower.includes('versus') ||
    lower.includes('gauntlet') ||
    lower.includes('leggings') ||
    lower.includes('warpath') ||
    lower.includes('shield') ||
    (lower.includes('blade') && lower.includes('dawn')) ||
    lower.includes('scythe') ||
    lower.includes('hammer') ||
    lower.includes('boots') ||
    lower.includes('greaves') ||
    lower.includes('hood') ||
    lower.includes('mask') ||
    lower.includes('vest') ||
    lower.includes('robe') ||
    lower.includes('crown') ||
    lower.includes('quiver') ||
    lower.includes('dagger') ||
    lower.includes('claw') ||
    lower.includes('scabskin') ||
    lower.includes('scabfall') ||
    lower.includes('ironrot') ||
    lower.includes('savage sash') ||
    lower.includes('scowling flesh bag') ||
    lower.includes('hexagore') ||
    lower.includes('heartened cross') ||
    lower.includes('nullrune') ||
    lower.includes('barkbone') ||
    lower.includes('arcane lantern')
  );
}

/**
 * Extracts cards currently in the player's hand, formatted with pitch suffixes (r), (y), (b).
 * Avoids opponent zones, equipment, tokens, and sideboard drawers.
 */
export function extractPlayerHand(
  doc: Document = document,
  knownEquipment: string[] = []
): string[] {
  // Normalize known equipment to lower case for exclusion
  const lowerEquip = new Set(knownEquipment.map((e) => e.trim().toLowerCase()).filter(Boolean));

  // Select candidate hand containers, ensuring we avoid equipment 'Hands' slots
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[class*="handZone"], [class*="HandZone"], [class*="playerHand"], [class*="PlayerHand"], [class*="myHand"], [class*="pOneHandZone"], [class*="pOneHand"], [class*="handContainer"], [class*="hand_"], [class*="Hand_"], [class*="hand" i], [id*="hand" i]'
    )
  ).filter((el) => {
    const c = (el.className?.toString() || '').toLowerCase();
    const id = (el.id || '').toLowerCase();

    // Exclude equipment zones e.g. pOneHands, pTwoHands, handsZone, handslot, equip
    if (
      c.includes('ponehands') ||
      c.includes('ptwohands') ||
      c.includes('handszone') ||
      c.includes('handslot') ||
      c.includes('equip') ||
      id.includes('equip')
    ) {
      return false;
    }
    // Avoid opponent containers and sidebar / drawer / sideboard containers
    if (
      c.includes('ptwo') ||
      c.includes('opponent') ||
      c.includes('sideboard') ||
      c.includes('drawer') ||
      c.includes('inventory') ||
      c.includes('decklist') ||
      c.includes('deckbuilder') ||
      id.includes('sideboard') ||
      id.includes('drawer')
    ) {
      return false;
    }
    // Skip entire page containers
    if (el === doc.body || el.tagName === 'HTML' || el.children.length > 30) {
      return false;
    }
    return true;
  });

  const handCards: string[] = [];

  for (const container of candidates) {
    const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
    const candidateCards: string[] = [];

    for (const img of imgs) {
      const alt = img.getAttribute('alt')?.trim();
      const title = img.getAttribute('title')?.trim();
      const src = img.getAttribute('src')?.trim();
      const rawName = alt || title || src;
      if (rawName) {
        const formatted = formatTalisharCardName(rawName);
        const lower = formatted.toLowerCase();
        if (
          formatted &&
          !lower.includes('hero') &&
          !lower.includes('portrait') &&
          !lower.includes('avatar') &&
          !lower.includes('token') &&
          !lower.includes('playmat') &&
          !lower.includes('difficulties') &&
          !lower.includes('back') &&
          !lowerEquip.has(lower) &&
          !isEquipmentOrWeapon(formatted)
        ) {
          candidateCards.push(formatted);
        }
      }
    }

    // In FAB, an active hand is between 1 and 10 cards. If candidate has cards in this range, accept it
    if (candidateCards.length > 0 && candidateCards.length <= 10) {
      handCards.push(...candidateCards);
      break;
    }
  }

  // Fallback: search containers holding card images from bottom-to-top
  if (handCards.length === 0) {
    const allContainers = Array.from(doc.querySelectorAll<HTMLElement>('div, section, ul'));
    for (let i = allContainers.length - 1; i >= 0; i--) {
      const container = allContainers[i];
      const c = (container.className?.toString() || '').toLowerCase();
      const id = (container.id || '').toLowerCase();
      if (
        c.includes('head') || c.includes('chest') || c.includes('hands') || c.includes('legs') ||
        c.includes('weapon') || c.includes('deck') || c.includes('grave') || c.includes('discard') ||
        c.includes('banish') || c.includes('pitch') || c.includes('sideboard') || c.includes('inventory') ||
        c.includes('ptwo') || c.includes('opponent') || id.includes('sideboard') || id.includes('inventory')
      ) {
        continue;
      }

      const imgs = Array.from(container.querySelectorAll<HTMLImageElement>(':scope > img, :scope > div > img'));
      if (imgs.length >= 1 && imgs.length <= 10) {
        const candidateCards: string[] = [];
        let hasJunk = false;
        for (const img of imgs) {
          const rawName = img.getAttribute('alt')?.trim() || img.getAttribute('title')?.trim() || img.getAttribute('src')?.trim();
          if (!rawName) continue;
          const formatted = formatTalisharCardName(rawName);
          const lower = formatted.toLowerCase();
          if (
            lower.includes('back') ||
            lower.includes('hero') ||
            lower.includes('avatar') ||
            lower.includes('portrait') ||
            lowerEquip.has(lower) ||
            isEquipmentOrWeapon(formatted)
          ) {
            hasJunk = true;
            break;
          }
          candidateCards.push(formatted);
        }

        if (!hasJunk && candidateCards.length >= 1 && candidateCards.length <= 10) {
          handCards.push(...candidateCards);
          break;
        }
      }
    }
  }

  return handCards;
}

/**
 * Finds the clickable tab element for the opponent in the Talishar DOM.
 */
export function findOpponentTabElement(doc: Document, opponentNameOrHero?: string): HTMLElement | null {
  const switchBtn = findSwitchPlayerStatsButton(doc);
  if (switchBtn) return switchBtn;

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
 * Checks whether a row text represents "Average Value per Turn".
 * Strictly rejects "Avg Resources per Turn", "Damage per Turn", etc.
 */
export function isAvgValueTurnRow(text: string): boolean {
  if (!text) return false;
  // Strictly exclude non-turn-value metrics
  if (
    /resource|recurso|damage|dano|threatened|card|pitch|action|defen[sc]|hand\s*size|drawn/i.test(
      text
    )
  ) {
    return false;
  }
  const hasAvg = /avg|average|m[eé]di[oa]/i.test(text);
  const hasValue = /value|valor/i.test(text);
  const hasTurn = /turn|turno/i.test(text);

  if (hasValue && hasTurn) {
    if (hasAvg) return true;
    if (/(?:value|valor)\s*(?:\/|per|por)\s*(?:turn|turno)/i.test(text)) return true;
  }
  return false;
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

    if (isAvgValueTurnRow(rowText)) {
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

      if (isAvgValueTurnRow(text)) {
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
 * Determines the match result (win/loss/draw) from victory or defeat indicators,
 * dialogs, and combat log lines (including concessions and game won announcements).
 */
export function parseMatchResult(
  doc: Document,
  logs?: string[],
  playerName?: string,
  opponentName?: string
): MatchResult {
  const victoryEl = doc.querySelector(
    '[class*="outcomeVictory"], [class*="OutcomeVictory"], [class*="victory"], [class*="Victory"]'
  );
  if (victoryEl) return 'win';

  const defeatEl = doc.querySelector(
    '[class*="outcomeDefeat"], [class*="OutcomeDefeat"], [class*="defeat"], [class*="Defeat"]'
  );
  if (defeatEl) return 'loss';

  // Fallback to text searching in game dialogs or end screen
  const endContainer = doc.querySelector(
    '[class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"], [class*="matchResult"], [class*="modal"], [class*="dialog"]'
  );
  if (endContainer) {
    const text = (endContainer.textContent || '').toUpperCase();
    if (text.includes('VICTORY') || text.includes('YOU WIN')) return 'win';
    if (text.includes('DEFEAT') || text.includes('YOU LOSE')) return 'loss';
  }

  // Extreme fallback: check all headings and button texts
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, [role="heading"], button, p, span'));
  for (const h of headings) {
    const txt = h.textContent?.trim().toUpperCase() || '';
    if (txt === 'VICTORY' || txt === 'YOU WIN') return 'win';
    if (txt === 'DEFEAT' || txt === 'YOU LOSE') return 'loss';
  }

  // Check combat logs for game endings and concessions
  const logLines = logs && logs.length > 0 ? logs : parseCombatLogs(doc);
  if (logLines && logLines.length > 0) {
    const pLower = playerName?.toLowerCase().trim();
    const oLower = opponentName?.toLowerCase().trim();

    // Check last 30 log lines in reverse (newest first)
    const recentLogs = [...logLines].slice(-30).reverse();

    for (const line of recentLogs) {
      const lower = line.toLowerCase();

      // Check concession
      if (
        lower.includes('conceded') ||
        lower.includes('concede') ||
        lower.includes('conceded the game') ||
        lower.includes('conceded the match')
      ) {
        if (oLower && lower.includes(oLower)) {
          return 'win';
        }
        if (pLower && lower.includes(pLower)) {
          return 'loss';
        }
      }

      // Check "won the game" / "has won the game" / "won the match"
      if (
        lower.includes('won the game') ||
        lower.includes('has won the game') ||
        lower.includes('won the match') ||
        lower.includes('has won the match')
      ) {
        if (pLower && lower.includes(pLower)) {
          return 'win';
        }
        if (oLower && lower.includes(oLower)) {
          return 'loss';
        }
      }

      // Check "was defeated" / "has been defeated" / "has lost the game"
      if (
        lower.includes('was defeated') ||
        lower.includes('has been defeated') ||
        lower.includes('has lost the game')
      ) {
        if (oLower && lower.includes(oLower)) {
          return 'win';
        }
        if (pLower && lower.includes(pLower)) {
          return 'loss';
        }
      }

      if (lower === 'victory' || lower === 'victory!' || lower.includes('you are victorious')) {
        return 'win';
      }
      if (lower === 'defeat' || lower === 'defeat!' || lower.includes('you were defeated')) {
        return 'loss';
      }
    }
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
/**
 * Identifies the turn with the most damage dealt for each player based on combat logs or EndGameStats table.
 */
export function parseMaxDamageTurn(
  logs: string[],
  playerName?: string,
  opponentName?: string,
  playerUsername?: string,
  opponentUsername?: string,
  doc?: Document
): {
  playerMaxDamage: number;
  playerMaxDamageTurn: number;
  opponentMaxDamage: number;
  opponentMaxDamageTurn: number;
} {
  let playerMax = 0;
  let playerMaxTurn = 0;
  let opponentMax = 0;
  let opponentMaxTurn = 0;

  // 1. Try reading from EndGameStats turn table if rendered in DOM
  if (doc) {
    const tables = Array.from(doc.querySelectorAll('table[class*="cardTable"]'));
    for (const table of tables) {
      const headers = Array.from(table.querySelectorAll('thead th')).map((h) =>
        h.textContent?.trim().toLowerCase() || ''
      );
      const dealtColIdx = headers.findIndex((h) => h.includes('dealt') || h.includes('dano causado'));
      const turnColIdx = headers.findIndex((h) => h === '#' || h.includes('turn'));
      if (dealtColIdx !== -1) {
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length > dealtColIdx) {
            const turnVal = turnColIdx !== -1 ? parseInt(cells[turnColIdx]?.textContent?.trim() || '0', 10) : 0;
            const dealtVal = parseInt(cells[dealtColIdx]?.textContent?.trim() || '0', 10);
            if (!isNaN(dealtVal) && dealtVal > playerMax) {
              playerMax = dealtVal;
              playerMaxTurn = turnVal;
            }
          }
        });
      }
    }
  }

  // 2. Parse from combat logs
  let currentTurn = 0;
  let activeTurnPlayer = '';
  let currentPlayerDamage = 0;
  let currentOpponentDamage = 0;

  const playerAliases = [playerName, playerUsername, 'player 1', 'jogador']
    .filter((s): s is string => Boolean(s && s.length > 1))
    .map((s) => s.toLowerCase());
  const opponentAliases = [opponentName, opponentUsername, 'player 2', 'oponente']
    .filter((s): s is string => Boolean(s && s.length > 1))
    .map((s) => s.toLowerCase());

  const isPlayerMatch = (text: string) => playerAliases.some((alias) => text.toLowerCase().includes(alias));
  const isOpponentMatch = (text: string) => opponentAliases.some((alias) => text.toLowerCase().includes(alias));

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

  // Match: "akiles185 took 4 damage", "takes 3 damage", "deals 5 damage", "dealt 4 damage", "lost 2 life"
  const dmgRegex = /(?:takes|took|deals|dealt|lost|loses)\s+(\d+)\s*(?:arcane\s+)?(?:damage|life)/i;
  const hitRegex = /(?:hits?|hit for)\s+(\d+)\s*(?:damage)?/i;

  for (const line of logs) {
    const turnDividerMatch = line.match(/Turn\s+(\d+)(?:\s*[-:]\s*([A-Za-z0-9_\-.]+))?/i);
    if (turnDividerMatch) {
      pushTurnResults();
      currentTurn = parseInt(turnDividerMatch[1], 10);
      if (turnDividerMatch[2]) {
        activeTurnPlayer = turnDividerMatch[2].trim().toLowerCase();
      }
      currentPlayerDamage = 0;
      currentOpponentDamage = 0;
      continue;
    }

    const match = line.match(dmgRegex) || line.match(hitRegex);
    if (match) {
      const dmg = parseInt(match[1], 10);
      if (!isNaN(dmg) && dmg > 0) {
        const lowerLine = line.toLowerCase();
        const isTookOrLost = /took|takes|lost|loses/i.test(line);
        const isDealtOrHit = /deals|dealt|hit/i.test(line);

        const mentionsPlayer = isPlayerMatch(lowerLine);
        const mentionsOpponent = isOpponentMatch(lowerLine);

        if (isTookOrLost) {
          if (mentionsPlayer) {
            // Player received damage -> Opponent dealt it
            currentOpponentDamage += dmg;
          } else if (mentionsOpponent) {
            // Opponent received damage -> Player dealt it
            currentPlayerDamage += dmg;
          } else {
            // No direct name mentioned; if active turn player is player, the opponent took damage
            if (activeTurnPlayer && isPlayerMatch(activeTurnPlayer)) {
              currentPlayerDamage += dmg;
            } else if (activeTurnPlayer && isOpponentMatch(activeTurnPlayer)) {
              currentOpponentDamage += dmg;
            } else {
              currentPlayerDamage += dmg;
            }
          }
        } else if (isDealtOrHit) {
          if (mentionsPlayer) {
            currentPlayerDamage += dmg;
          } else if (mentionsOpponent) {
            currentOpponentDamage += dmg;
          } else {
            if (activeTurnPlayer && isPlayerMatch(activeTurnPlayer)) {
              currentPlayerDamage += dmg;
            } else {
              currentOpponentDamage += dmg;
            }
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
    opponentMaxDamageTurn: opponentMaxTurn,
  };
}

/**
 * Parses fatigue (cards left in deck) from the DOM or EndGameStats table.
 */
export function parseFatigue(
  doc: Document,
  cachedPlayerFatigue?: number,
  cachedOpponentFatigue?: number
): { playerFatigue?: number; opponentFatigue?: number } {
  const getDeckCount = (deckZone: Element | null): number | undefined => {
    if (!deckZone) return undefined;
    const numEl = deckZone.querySelector(
      '[class*="number"] [class*="text"], [class*="number"], [class*="deckCount"], [class*="badge"], [class*="count"]'
    );
    if (numEl && numEl.textContent) {
      const val = parseInt(numEl.textContent.trim(), 10);
      if (!isNaN(val)) return val;
    }
    // If deck zone is present but has no number badge, deck is 0 (fully fatigued)
    const text = deckZone.textContent?.trim().toLowerCase();
    if (text === 'deck' || text === 'baralho') {
      return 0;
    }
    return undefined;
  };

  // 1. Desktop GridBoard deck zones
  const pOneDeck = doc.querySelector(
    '[class*="pOneDeck"], [class*="PlayerBoardGrid"] [class*="deckZone"], [class*="PlayerBoardGrid"]'
  );
  const pTwoDeck = doc.querySelector(
    '[class*="pTwoDeck"], [class*="OpponentBoardGrid"] [class*="deckZone"], [class*="OpponentBoardGrid"]'
  );

  let playerFatigue = getDeckCount(pOneDeck);
  let opponentFatigue = getDeckCount(pTwoDeck);

  // 2. EndGameStats turn results table fallback (reads cardsLeft from last row)
  if (playerFatigue === undefined) {
    const cardTables = Array.from(doc.querySelectorAll('table[class*="cardTable"]'));
    for (const table of cardTables) {
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const cells = Array.from(lastRow.querySelectorAll('td'));
        if (cells.length >= 6) {
          const val = parseInt(cells[5].textContent?.trim() || cells[4].textContent?.trim() || '', 10);
          if (!isNaN(val)) {
            playerFatigue = val;
            break;
          }
        }
      }
    }
  }

  // 3. Fallback to cached fatigue values from during-game state
  if (playerFatigue === undefined && cachedPlayerFatigue !== undefined) {
    playerFatigue = cachedPlayerFatigue;
  }
  if (opponentFatigue === undefined && cachedOpponentFatigue !== undefined) {
    opponentFatigue = cachedOpponentFatigue;
  }

  return { playerFatigue, opponentFatigue };
}

/**
 * Extracts a complete MatchRecord snapshot from the current DOM state.
 */
export function extractMatchRecordFromDom(
  doc: Document = document,
  options?: {
    cachedPlayerEquipment?: string[];
    cachedOpponentEquipment?: string[];
    initialPlayerEquipment?: string[];
    initialOpponentEquipment?: string[];
    cachedPlayerFatigue?: number;
    cachedOpponentFatigue?: number;
    turnHands?: Map<number, string[]> | Record<number, string[]>;
  }
): Partial<MatchRecord> {
  const { player: playerName, opponent: oppName, playerUsername, opponentUsername } = parsePlayerNames(doc);
  const { playerHero, opponentHero } = parseHeroNames(doc);
  const parsedLogs = parseCombatLogs(doc);

  let rawLogs = parsedLogs;
  if (options?.turnHands) {
    const hands = options.turnHands;
    const enriched: string[] = [];
    const insertedTurns = new Set<number>();
    for (const line of parsedLogs) {
      enriched.push(line);
      const match = line.match(/Turn\s+(\d+)/i);
      if (match) {
        const turnNo = parseInt(match[1], 10);
        if (!insertedTurns.has(turnNo)) {
          const cards = hands instanceof Map ? hands.get(turnNo) : (hands as any)[turnNo];
          if (cards && cards.length > 0) {
            const cleanCards = cards.filter(
              (c: string) =>
                !isEquipmentOrWeapon(c) &&
                !c.toLowerCase().includes('back') &&
                !c.toLowerCase().includes('hero')
            );
            if (cleanCards.length > 0) {
              enriched.push(`[Mão Comprada - Turno ${turnNo}]: ${cleanCards.join(', ')}`);
              insertedTurns.add(turnNo);
            }
          }
        }
      }
    }
    rawLogs = enriched;
  }

  const turnsCount = parseTurnCount(doc, rawLogs);
  const result = parseMatchResult(doc, rawLogs, playerName, oppName);
  const wentFirst = parseWentFirst(rawLogs, playerName || playerUsername, oppName || opponentUsername);
  const { playerAvgTurnValue, opponentAvgTurnValue } = parseAverageTurnValues(
    doc,
    oppName || opponentHero,
    playerName || playerHero
  );
  const { playerEquipment, opponentEquipment } = parseEquipment(
    doc,
    options?.initialPlayerEquipment && options.initialPlayerEquipment.length > 0
      ? options.initialPlayerEquipment
      : options?.cachedPlayerEquipment,
    options?.initialOpponentEquipment && options.initialOpponentEquipment.length > 0
      ? options.initialOpponentEquipment
      : options?.cachedOpponentEquipment
  );

  const finalPlayerEquipment =
    options?.initialPlayerEquipment && options.initialPlayerEquipment.length > 0
      ? options.initialPlayerEquipment
      : playerEquipment;

  const finalOpponentEquipment =
    options?.initialOpponentEquipment && options.initialOpponentEquipment.length > 0
      ? options.initialOpponentEquipment
      : opponentEquipment;

  const { playerFatigue, opponentFatigue } = parseFatigue(
    doc,
    options?.cachedPlayerFatigue,
    options?.cachedOpponentFatigue
  );
  const { playerMaxDamage, playerMaxDamageTurn, opponentMaxDamage, opponentMaxDamageTurn } = parseMaxDamageTurn(
    rawLogs,
    playerName,
    oppName,
    playerUsername,
    opponentUsername,
    doc
  );

  const player: PlayerStats = {
    name: playerName || 'Jogador',
    hero: playerHero || '-',
    username: playerUsername,
    avgTurnValue: playerAvgTurnValue,
    fatigue: playerFatigue,
    maxDamage: playerMaxDamage,
    maxDamageTurn: playerMaxDamageTurn,
  };

  const opponent: PlayerStats = {
    name: oppName || 'Oponente',
    hero: opponentHero || '-',
    username: opponentUsername,
    avgTurnValue: opponentAvgTurnValue,
    fatigue: opponentFatigue,
    maxDamage: opponentMaxDamage,
    maxDamageTurn: opponentMaxDamageTurn,
  };

  return {
    id: `talishar-${Date.now()}`,
    timestamp: new Date().toISOString(),
    player,
    opponent,
    result,
    turnsCount,
    rawLogs,
    playerEquipment: finalPlayerEquipment,
    opponentEquipment: finalOpponentEquipment,
    format: 'CC',
    wentFirst,
    platform: 'Talishar',
  };
}
