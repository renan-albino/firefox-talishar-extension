# 09: Fix Modal Trigger, Game Over Detection, Log Download & Chronological Append

**Status**: resolved
**Labels**: bug, triage-resolved, ready-for-human

## Summary
Addressing issues reported during extension testing on Talishar.net:
1. "Salvar/Exportar Última Partida" popup button failed to open the in-game notes modal (clicking it caused the popup to close immediately).
2. The orange floating button did not appear or failed to open upon match finish (especially concessions and varying DOM end states).
3. The button to download the full match log (.txt) was missing from the popup and inaccessible in-game.
4. When importing historical CSV spreadsheets, new matches were placed on top instead of appending to the bottom rows.

## Root Causes
1. **Firefox WebExtension Popup alert() termination**: Calling `window.alert()` inside an extension popup in Firefox immediately dismisses and terminates the popup window.
2. **Empty History Rejection**: `OPEN_MODAL_LAST_MATCH` rejected when no match was saved in storage, triggering popup errors.
3. **Talishar Ad Blocker DOM lock (`useAdScript.ts`)**: Talishar runs an anti-interstitial loop every 150ms (`lockNonRootBodyChildren`) setting `visibility: hidden !important` and `pointer-events: none !important` on direct `document.body` children unless they match `CMP_SELECTOR` (`[id^="sp_message_container"]`, etc.).
4. **Chronological Storage Order**: `saveMatchToHistory` was prepending `[match, ...history]` and `importMatchesFromCsv` sorted descending, inverting spreadsheet row expectations.

## Delivered
1. **Popup Modal Trigger & Inline Feedback**:
   - Replaced all `alert()` calls in `popup/main.ts` with inline status text (`#export-last-match-status`), preventing popup window dismissal.
   - `OPEN_MODAL_LAST_MATCH` now falls back to creating a draft match record when history and DOM are empty, ensuring the modal opens 100% of the time.
2. **In-Game CMP Injection Container**:
   - Implemented `getExtensionMountHost()` in `entrypoints/content.ts` creating `<div id="sp_message_container_talishar">` inside `document.body`.
   - Bypasses Talishar's `useAdScript.ts` via its whitelisted `CMP_SELECTOR`, causing Talishar to explicitly call `unlockElementTree(h)` and retain full visibility and interactivity.
   - Preserved `z-index: 2147483647 !important;` and fixed viewport coordinates.
3. **Game Over & Concession Detection**:
   - Extended `parseMatchResult` in `talisharDom.ts` to inspect combat logs for concessions (`"X conceded"`, `"X has conceded"`) and victory messages.
   - Added `cardListBox` selector to `hasGameOver` detection.
   - Fixed state flapping: state remains in `Fim de Partida (Game Over)` until returning to the lobby.
4. **Full Match Log (.txt) Download**:
   - Added `📄 Baixar Log (.txt)` in popup under "Dados Locais".
   - Ensured `📄 Baixar Log Completo (.txt)` in the in-game modal works with status feedback.
   - Substitutes player usernames with hero names for optimal AI reasoning.
5. **Chronological Storage & CSV Append (Novos Jogos Embaixo)**:
   - Updated `saveMatchToHistory` to append matches to the end (`[...filtered, match]`).
   - Updated `getMatchHistory` to guarantee chronological ascending sort (`oldest -> newest`).
   - Updated `importMatchesFromCsv` to preserve row sequence offsets and sort chronologically.
   - `formatMatchHistoryCsv` now generates CSVs with oldest games at the top and newly played games appended at the bottom rows.
6. **Testing & Build Verification**:
   - Added unit tests in `src/utils/storage.test.ts`.
   - All 39 Vitest tests passing across 8 test suites.
   - TypeScript compilation clean (`tsc --noEmit` with 0 errors).
   - Production bundle compiled with `wxt build -b firefox`.
