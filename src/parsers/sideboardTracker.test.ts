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
      expect(formatTalisharCardName('savage_feast_red-1')).toBe('Savage Feast (r)');
      expect(formatTalisharCardName('sink_below_blue-2')).toBe('Sink Below (b)');
      expect(formatTalisharCardName('pummel_yellow')).toBe('Pummel (y)');
      expect(formatTalisharCardName('command_and_conquer_red')).toBe('Command And Conquer (r)');
      expect(formatTalisharCardName('dawnblade')).toBe('Dawnblade');
      expect(formatTalisharCardName('hunters_klaive_r')).toBe('Hunters Klaive');
      expect(formatTalisharCardName('harmonized_kodachi_l')).toBe('Harmonized Kodachi');
      expect(formatTalisharCardName('cintari_saber-r')).toBe('Cintari Saber');
    });

    it('should format card image URLs', () => {
      const url = 'https://images.talishar.net/public/cardsquares/english/fate_foreseen_red.webp';
      expect(formatTalisharCardName(url)).toBe('Fate Foreseen (r)');
      const weaponUrl = 'https://images.talishar.net/public/cardsquares/english/hunters_klaive_r.webp';
      expect(formatTalisharCardName(weaponUrl)).toBe('Hunters Klaive');
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
      expect(adjustment.cardsLeftOut).toContain('Sink Below (r)');
      expect(adjustment.cardsLeftOut).toContain('Pummel (r)');
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
      expect(cards).toContain('Unmovable (b)');
      expect(cards).toContain('Oasis Respite (r)');
    });
  });

  describe('trackLobbyEquipment', () => {
    it('should extract checked equipment and weapons from lobby DOM', () => {
      const doc = document.implementation.createHTMLDocument();
      doc.body.innerHTML = `
        <div class="Equipment_container">
          <div class="Equipment_categoryContainer">
            <label>
              <input type="radio" name="head" value="mask_of_deceit" checked />
              <img src="/cards/mask_of_deceit.webp" alt="Mask of Deceit" />
            </label>
            <label>
              <input type="radio" name="head" value="NONE00" />
            </label>
          </div>
          <div class="Equipment_categoryContainer">
            <label>
              <input type="radio" name="chest" value="fyendals_spring_tunic" checked />
              <img src="/cards/fyendals_spring_tunic.webp" alt="Fyendals Spring Tunic" />
            </label>
          </div>
          <div class="Equipment_categoryContainer">
            <label>
              <input type="checkbox" name="weapons" value="hunters_klaive_r" checked />
              <img src="/cards/hunters_klaive_r.webp" alt="Hunters Klaive" />
            </label>
            <label>
              <input type="checkbox" name="weapons" value="graphene_chelicera" />
              <img src="/cards/graphene_chelicera.webp" alt="Graphene Chelicera" />
            </label>
          </div>
        </div>
      `;

      const adjustment = trackLobbyDeckState(doc);
      expect(adjustment.equippedItems).toBeDefined();
      expect(adjustment.equippedItems).toContain('Mask of Deceit');
      expect(adjustment.equippedItems).toContain('Fyendals Spring Tunic');
      expect(adjustment.equippedItems).toContain('Hunters Klaive');
      expect(adjustment.equippedItems).not.toContain('Graphene Chelicera');
      expect(adjustment.cardsLeftOut).toContain('Graphene Chelicera');
    });
  });
});
