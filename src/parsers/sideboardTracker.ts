import type { DeckAdjustment } from '../types/match';

/**
 * Checks if the current document is inside the pre-game lobby/sideboard stage.
 */
export function isPreGameLobby(doc: Document = document): boolean {
  return (
    doc.querySelector(
      '[class*="deckContainer"], [class*="DeckContainer"], [class*="Lobby"], [class*="lobbyContainer"]'
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

    let cardName: string | undefined;

    if (container) {
      const img = container.querySelector('img');
      cardName = img?.getAttribute('alt') || img?.getAttribute('title') || undefined;
    }

    if (!cardName) {
      cardName = input.value || 'Carta Desconhecida';
    }

    if (input.checked) {
      mainDeckCount++;
      cardsAdded.push(cardName);
    } else {
      cardsLeftOut.push(cardName);
    }
  });

  return {
    cardsLeftOut,
    cardsAdded,
    mainDeckCount,
  };
}
