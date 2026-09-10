import { describe, it, expect } from 'vitest';
import {
  formatTalisharCardName,
  trackLobbyDeckState,
  isPreGameLobby,
  trackInGameInventory,
} from './sideboardTracker';

describe('sideboardTracker', () => {
  describe('formatTalisharCardName', () => {
    it('should format snake_case card identifiers with pitch suffixes', () => {
      expect(formatTalisharCardName('savage_feast_red-1')).toBe('Savage Feast (Red)');
      expect(formatTalisharCardName('sink_below_blue-2')).toBe('Sink Below (Blue)');
      expect(formatTalisharCardName('pummel_yellow')).toBe('Pummel (Yellow)');
      expect(formatTalisharCardName('command_and_conquer_red')).toBe('Command And Conquer (Red)');
      expect(formatTalisharCardName('dawnblade')).toBe('Dawnblade');
    });

    it('should format card image URLs', () => {
      const url = 'https://images.talishar.net/public/cardsquares/english/fate_foreseen_red.webp';
      expect(formatTalisharCardName(url)).toBe('Fate Foreseen (Red)');
    });
  });

  describe('trackLobbyDeckState', () => {
    it('should track cards left out and format their names', () => {
      const doc = document.implementation.createHTMLDocument();
      doc.body.innerHTML = `
        <div class="Deck_deckContainer__456">
          <div class="Deck_deckCardContainer__1">
            <label>
              <input type="checkbox" name="deck" value="command_and_conquer_red-1" checked />
              <img src="/public/cardsquares/english/command_and_conquer_red.webp" />
            </label>
          </div>
          <div class="Deck_deckCardContainer__2">
            <label>
              <input type="checkbox" name="deck" value="sink_below_red-1" />
              <img src="/public/cardsquares/english/sink_below_red.webp" />
            </label>
          </div>
          <div class="Deck_deckCardContainer__3">
            <label>
              <input type="checkbox" name="deck" value="pummel_red-1" />
              <img src="/public/cardsquares/english/pummel_red.webp" />
            </label>
          </div>
        </div>
      `;

      const adjustment = trackLobbyDeckState(doc);
      expect(adjustment.mainDeckCount).toBe(1);
      expect(adjustment.cardsLeftOut).toHaveLength(2);
      expect(adjustment.cardsLeftOut).toContain('Sink Below (Red)');
      expect(adjustment.cardsLeftOut).toContain('Pummel (Red)');
    });
  });

  describe('trackInGameInventory', () => {
    it('should extract inventory cards from InventoryModal DOM', () => {
      const doc = document.implementation.createHTMLDocument();
      doc.body.innerHTML = `
        <div class="Inventory_inventoryModal__123">
          <div class="Inventory_cardGrid__456">
            <div class="Inventory_cardContainer__1">
              <img src="https://images.talishar.net/public/cardsquares/english/unmovable_blue.webp" />
            </div>
            <div class="Inventory_cardContainer__2">
              <img src="https://images.talishar.net/public/cardsquares/english/oasis_respite_red.webp" />
            </div>
          </div>
        </div>
      `;

      const cards = trackInGameInventory(doc);
      expect(cards).toHaveLength(2);
      expect(cards).toContain('Unmovable (Blue)');
      expect(cards).toContain('Oasis Respite (Red)');
    });
  });
});
