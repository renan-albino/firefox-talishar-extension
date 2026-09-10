# Issue 07: Fix CORS/NetworkError, Full Action Logs & Sideboard Persistence

**Status**: Completed
**Labels**: bug, triage-resolved, ready-for-human

## Summary
Diagnosed and fixed 3 issues discovered during live testing on Talishar.net:
1. **NetworkError on Google Sheets Export**: Direct fetch from talishar.net blocked by page CSP and CORS 302 redirects.
2. **Missing Action Logs**: Combat actions (cards played, blocks, pitches) were dropped because parseCombatLogs filtered elements with children, and deduplication stripped repeated actions.
3. **Empty Sideboard**: Lobby deck state lost across client-side route transitions and raw card IDs (savage_feast_red-1) were unformatted.

## Root Causes & Resolutions
- **Issue 1 (NetworkError)**:
  - Delegated Sheets API dispatch to entrypoints/background.ts via browser.runtime.sendMessage.
  - Added https://script.google.com/* and https://script.googleusercontent.com/* to host_permissions in wxt.config.ts.
- **Issue 2 (Combat Logs)**:
  - Selected [class*=chatMessage], [class*=chatMobileMessage], [class*=turnDivider], [class*=combatGroupLabel].
  - Filtered sub-spans of turnDivider to prevent fragmented lines like Turn 1akiles185.
  - Formatted turn dividers cleanly as Turn X - PlayerName.
  - Removed deduplication logic that stripped repeated actions and combat chain closures across turns.
- **Issue 3 (Sideboard Tracking)**:
  - Added formatTalisharCardName() to transform identifiers like savage_feast_red-1 into Savage Feast (Red).
  - Stored tracked deck adjustments in sessionStorage (talishar_sideboard_cache) to survive client-side route transitions (/lobby -> /play).
  - Added fallback to read in-game InventoryModal when opened.

## Verification
- Vitest: 6 test suites, 22 passed.
- TypeScript compiler (npm run compile): 0 errors.
- Extension build (npm run build): .output/firefox-mv2/ built successfully with background.js and updated content.js.
