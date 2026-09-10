# 05: Pre-game Deck and Sideboard Tracker

**What to build:**
A detector that monitors the pre-game deck/equipment configuration stage in Talishar to capture cards swapped or excluded from the main deck (especially when main deck < 60 cards).

**Blocked by:** 04-talishar-dom-parser

**Status:** ready-for-agent

- [ ] Implement `src/parsers/sideboardTracker.ts` to detect pre-game deck selection screens.
- [ ] Record excluded cards, extra sideboard cards, and main deck card count.
- [ ] Store pre-game deck state in the active match session.
- [ ] Unit tests for deck count calculation and sideboard diffing.
