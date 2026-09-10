# 04: Talishar DOM Parser for Combat Log, Players & Average Turn Values

**What to build:**
A DOM parsing module that extracts player names, hero identities, ongoing combat log lines, match end state (winner/loser), and the Average Turn Value metrics displayed by Talishar for both players.

**Blocked by:** 01-project-scaffolding

**Status:** ready-for-agent

- [ ] Implement DOM selectors and extraction functions in `src/parsers/talisharDom.ts`.
- [ ] Parse player names, selected hero cards, and life totals.
- [ ] Parse in-game combat log messages with timestamps and turn counters.
- [ ] Extract Average Turn Value numbers for both the active player and opponent.
- [ ] Unit tests with mock Talishar DOM structures verifying accurate data extraction.
