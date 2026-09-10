# 05: Pre-game Deck and Sideboard Tracker

**What to build:**
A detector that monitors the pre-game deck/equipment configuration stage in Talishar to capture cards swapped or excluded from the main deck (especially when main deck < 60 cards).

**Blocked by:** 04-talishar-dom-parser

**Status:** resolved

- [x] Implement `src/parsers/sideboardTracker.ts` to detect pre-game deck selection screens.
- [x] Record excluded cards, extra sideboard cards, and main deck card count.
- [x] Store pre-game deck state in the active match session.
- [x] Unit tests for deck count calculation and sideboard diffing.

## Answer

Delivered:
- `src/parsers/sideboardTracker.ts` to detect Talishar pre-game lobby deck selections.
- Captures cards selected for main deck and cards left out in the sideboard (handling sub-60 and standard decks).
- `src/parsers/sideboardTracker.test.ts` passing all test cases in Vitest.
