import type { DeckAdjustment } from '../types/match';

const SIDEBOARD_STORAGE_KEY = 'talishar_sideboard_cache';

/**
 * Converts Talishar's card identifiers or image paths (e.g. "savage_feast_red-1")
 * into human-readable card names (e.g. "Savage Feast (Red)").
 */
export function formatTalisharCardName(input: string): string {
  if (!input) return '';

  let clean = input.trim();

  // If input is an image URL or path, extract basename
  const slashIdx = clean.lastIndexOf('/');
  if (slashIdx !== -1) {
    clean = clean.substring(slashIdx + 1);
  }
  clean = clean.replace(/\.(webp|png|jpg|jpeg)$/i, '');

  // Strip instance index e.g. "-1", "-2"
  clean = clean.replace(/-\d+$/, '');

  // Detect pitch suffix: _red, _yellow, _blue
  let pitchSuffix = '';
  if (clean.endsWith('_red')) {
    pitchSuffix = ' (r)';
    clean = clean.slice(0, -4);
  } else if (clean.endsWith('_yellow')) {
    pitchSuffix = ' (y)';
    clean = clean.slice(0, -7);
  } else if (clean.endsWith('_blue')) {
    pitchSuffix = ' (b)';
    clean = clean.slice(0, -5);
  }

  // If input already contains spaces and no underscores, return as is (already human readable)
  if (clean.includes(' ') && !clean.includes('_')) {
    return clean
      .replace(/\s*\((?:Red|Vermelha|1)\)$/i, ' (r)')
      .replace(/\s*\((?:Yellow|Amarela|2)\)$/i, ' (y)')
      .replace(/\s*\((?:Blue|Azul|3)\)$/i, ' (b)');
  }

  // Convert snake_case or kebab-case to Title Case words
  const words = clean
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  if (words.length === 0) return input;

  return `${words.join(' ')}${pitchSuffix}`;
}

/**
 * Checks if the current document is inside the pre-game lobby/sideboard stage.
 */
export function isPreGameLobby(doc: Document = document): boolean {
  // If game over is present, it is NEVER the pre-game lobby
  const hasGameOver = doc.querySelector(
    '[class*="outcomeVictory"], [class*="OutcomeVictory"], [class*="outcomeDefeat"], [class*="OutcomeDefeat"], [class*="statsContainer"], [class*="endGame"], [class*="EndGameStats"], [class*="cardListBox"], [class*="cardListTitle"], [class*="matchResult"], [class*="victory"], [class*="defeat"], [class*="Victory"], [class*="Defeat"], [class*="gameOver"], [class*="GameOver"]'
  ) !== null;
  if (hasGameOver) return false;

  // If active in-game board exists, it is NOT the pre-game lobby
  // Note: LobbyChat contains chatBox, so we do NOT check chatBox here.
  const hasInGameBoard = doc.querySelector(
    '[class*="PlayerBoardGrid"], [class*="playerBoard"], [class*="OpponentBoardGrid"], [class*="combatGroupLabel"], [class*="pOneDeck"], [class*="pTwoDeck"], [class*="pOneHead"], [class*="pTwoHead"], [class*="combatChain"]'
  ) !== null;
  if (hasInGameBoard) return false;

  return (
    doc.querySelector(
      '[class*="lobbyClass"], [class*="Lobby"], [class*="deckContainer"], [class*="DeckContainer"], [class*="eqCategory"], [class*="stickyFooter"], input[name="deck"], [class*="lobbyContainer"]'
    ) !== null
  );
}

/**
 * Parses deck checkboxes and equipment in the Talishar lobby to identify main deck cards vs cards left out in the sideboard.
 */
export function trackLobbyDeckState(doc: Document = document): DeckAdjustment {
  const cardsLeftOut: string[] = [];
  const cardsAdded: string[] = [];
  let mainDeckCount = 0;

  // 1. Deck cards (checkboxes)
  const cardInputs = Array.from(
    doc.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="deck"], [class*="deckContainer"] input[type="checkbox"], [class*="deckCardContainer"] input[type="checkbox"]'
    )
  );

  cardInputs.forEach((input) => {
    const parentLabel = input.closest('label');
    const container = input.closest('[class*="deckCardContainer"]') || parentLabel;

    let rawIdentifier = input.value;

    if (container) {
      const img = container.querySelector('img');
      const imgAlt = img?.getAttribute('alt');
      const imgSrc = img?.getAttribute('src');
      if (imgAlt && imgAlt.trim().length > 0) {
        rawIdentifier = imgAlt;
      } else if (imgSrc) {
        rawIdentifier = imgSrc;
      }
    }

    const formattedName = formatTalisharCardName(rawIdentifier);

    if (input.checked) {
      mainDeckCount++;
      cardsAdded.push(formattedName);
    } else {
      if (formattedName && !cardsLeftOut.includes(formattedName)) {
        cardsLeftOut.push(formattedName);
      }
    }
  });

  // 2. Equipment categories in lobby: cards that are not equipped/selected
  const eqContainers = Array.from(
    doc.querySelectorAll('[class*="eqCategory"], [class*="categoryContainer"]')
  );
  eqContainers.forEach((eqBox) => {
    // Unchecked weapon checkboxes
    const unequippedWeapons = Array.from(
      eqBox.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not(:checked)')
    );
    unequippedWeapons.forEach((input) => {
      const label = input.closest('label') || input.parentElement;
      const img = label?.querySelector('img');
      const raw = input.value || img?.getAttribute('alt') || img?.getAttribute('src') || '';
      const formatted = formatTalisharCardName(raw);
      if (formatted && formatted !== 'NONE00' && !cardsLeftOut.includes(formatted)) {
        cardsLeftOut.push(formatted);
      }
    });

    // Unselected radio equipment options
    const radioInputs = Array.from(
      eqBox.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:checked)')
    );
    radioInputs.forEach((radio) => {
      const val = radio.value;
      if (val && val !== 'NONE00') {
        const label = radio.closest('label') || radio.parentElement;
        const img = label?.querySelector('img');
        const formatted = formatTalisharCardName(img?.getAttribute('alt') || img?.getAttribute('src') || val);
        if (formatted && formatted !== 'NONE00' && !cardsLeftOut.includes(formatted)) {
          cardsLeftOut.push(formatted);
        }
      }
    });
  });

  const adjustment: DeckAdjustment = {
    cardsLeftOut,
    cardsAdded,
    mainDeckCount,
  };

  // Persist immediately if main deck cards were found or sideboard cards were detected
  if (mainDeckCount > 0 || cardsLeftOut.length > 0) {
    saveSideboardToStorage(adjustment);
  }

  return adjustment;
}

/**
 * Checks if the in-game InventoryModal is open in the DOM and extracts its cards.
 */
export function trackInGameInventory(doc: Document = document): string[] {
  const inventoryModal = doc.querySelector(
    '[class*="inventoryModal"], [class*="InventoryModal"], [class*="inventory"], [class*="Inventory"]'
  );
  if (!inventoryModal) return [];

  const cards: string[] = [];
  const images = Array.from(inventoryModal.querySelectorAll('img'));

  images.forEach((img) => {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const name = formatTalisharCardName(alt || src);
    if (name && !cards.includes(name)) {
      cards.push(name);
    }
  });

  return cards;
}

/**
 * Saves sideboard adjustment to sessionStorage so it survives client-side route transitions and reloads.
 */
export function saveSideboardToStorage(adjustment: DeckAdjustment): void {
  try {
    sessionStorage.setItem(SIDEBOARD_STORAGE_KEY, JSON.stringify(adjustment));
  } catch (e) {
    // sessionStorage not available
  }
}

/**
 * Retrieves the saved sideboard adjustment from sessionStorage.
 */
export function getSavedSideboard(): DeckAdjustment | null {
  try {
    const item = sessionStorage.getItem(SIDEBOARD_STORAGE_KEY);
    if (item) {
      return JSON.parse(item) as DeckAdjustment;
    }
  } catch (e) {
    // sessionStorage not available
  }
  return null;
}
