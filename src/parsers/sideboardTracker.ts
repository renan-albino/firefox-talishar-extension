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
    pitchSuffix = ' (Red)';
    clean = clean.slice(0, -4);
  } else if (clean.endsWith('_yellow')) {
    pitchSuffix = ' (Yellow)';
    clean = clean.slice(0, -7);
  } else if (clean.endsWith('_blue')) {
    pitchSuffix = ' (Blue)';
    clean = clean.slice(0, -5);
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
  return (
    doc.querySelector(
      '[class*="deckContainer"], [class*="DeckContainer"], [class*="Lobby"], [class*="lobbyContainer"], [class*="deckCardContainer"]'
    ) !== null
  );
}

/**
 * Parses deck checkboxes in the Talishar lobby to identify main deck cards vs cards left out in the sideboard.
 */
export function trackLobbyDeckState(doc: Document = document): DeckAdjustment {
  const cardsLeftOut: string[] = [];
  const cardsAdded: string[] = [];
  let mainDeckCount = 0;

  const cardInputs = Array.from(
    doc.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="deck"], [class*="deckCardContainer"] input[type="checkbox"]'
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

  const adjustment: DeckAdjustment = {
    cardsLeftOut,
    cardsAdded,
    mainDeckCount,
  };

  // Persist immediately if main deck cards were found
  if (mainDeckCount > 0) {
    saveSideboardToStorage(adjustment);
  }

  return adjustment;
}

/**
 * Checks if the in-game InventoryModal is open in the DOM and extracts its cards.
 */
export function trackInGameInventory(doc: Document = document): string[] {
  const inventoryModal = doc.querySelector('[class*="inventoryModal"], [class*="InventoryModal"]');
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
