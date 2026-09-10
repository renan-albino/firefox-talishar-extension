import { describe, it, expect } from 'vitest';
import { trackLobbyDeckState, isPreGameLobby } from './sideboardTracker';

describe('sideboardTracker', () => {
  it('should detect if current page is pre-game lobby', () => {
    const doc = document.implementation.createHTMLDocument();
    expect(isPreGameLobby(doc)).toBe(false);

    doc.body.innerHTML = `
      <div class="Lobby_lobbyContainer__123">
        <div class="Deck_deckContainer__456"></div>
      </div>
    `;
    expect(isPreGameLobby(doc)).toBe(true);
  });

  it('should track cards left out and main deck card count', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = `
      <div class="Deck_deckContainer__456">
        <div class="Deck_deckCardContainer__1">
          <label>
            <input type="checkbox" name="deck" value="CRU001-1" checked />
            <img alt="Command and Conquer" />
          </label>
        </div>
        <div class="Deck_deckCardContainer__2">
          <label>
            <input type="checkbox" name="deck" value="CRU001-2" checked />
            <img alt="Command and Conquer" />
          </label>
        </div>
        <div class="Deck_deckCardContainer__3">
          <label>
            <input type="checkbox" name="deck" value="WTR123-1" />
            <img alt="Pummel (Red)" />
          </label>
        </div>
        <div class="Deck_deckCardContainer__4">
          <label>
            <input type="checkbox" name="deck" value="WTR124-1" />
            <img alt="Sink Below (Red)" />
          </label>
        </div>
      </div>
    `;

    const adjustment = trackLobbyDeckState(doc);
    expect(adjustment.mainDeckCount).toBe(2);
    expect(adjustment.cardsLeftOut).toHaveLength(2);
    expect(adjustment.cardsLeftOut).toContain('Pummel (Red)');
    expect(adjustment.cardsLeftOut).toContain('Sink Below (Red)');
  });

  it('should handle sub-60 card main decks (e.g. Blitz 40 cards)', () => {
    const doc = document.implementation.createHTMLDocument();
    let cardsHtml = '';
    // 40 checked cards, 12 unchecked cards
    for (let i = 1; i <= 40; i++) {
      cardsHtml += `
        <div class="Deck_deckCardContainer">
          <label>
            <input type="checkbox" name="deck" value="CARD-${i}" checked />
            <img alt="Main Deck Card ${i}" />
          </label>
        </div>
      `;
    }
    for (let i = 1; i <= 12; i++) {
      cardsHtml += `
        <div class="Deck_deckCardContainer">
          <label>
            <input type="checkbox" name="deck" value="SIDE-${i}" />
            <img alt="Sideboard Card ${i}" />
          </label>
        </div>
      `;
    }

    doc.body.innerHTML = `<div class="Deck_deckContainer">${cardsHtml}</div>`;

    const adjustment = trackLobbyDeckState(doc);
    expect(adjustment.mainDeckCount).toBe(40);
    expect(adjustment.cardsLeftOut).toHaveLength(12);
  });
});
