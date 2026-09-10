# 04: Talishar DOM Parser for Combat Log, Players & Average Turn Values

**What to build:**
A DOM parsing module that extracts player names, hero identities, ongoing combat log lines, match end state (winner/loser), and the Average Turn Value metrics displayed by Talishar for both players.

**Blocked by:** 01-project-scaffolding

**Status:** resolved

- [x] Implement DOM selectors and extraction functions in `src/parsers/talisharDom.ts`.
- [x] Parse player names, selected hero cards, and life totals.
- [x] Parse in-game combat log messages with timestamps and turn counters.
- [x] Extract Average Turn Value numbers for both the active player and opponent.
- [x] Unit tests with mock Talishar DOM structures verifying accurate data extraction.

## Answer

Delivered:
- `src/parsers/talisharDom.ts` with robust DOM selectors for players, heroes, combat log stream, turn count, match result, and Average Turn Value metrics.
- `src/parsers/talisharDom.test.ts` covering extraction scenarios with mock DOM trees.
- All 14 tests passing in Vitest.
