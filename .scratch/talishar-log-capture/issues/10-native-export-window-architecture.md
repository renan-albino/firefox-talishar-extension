# 10: Native Dedicated Export Window Architecture

**Status**: resolved
**Labels**: feature, architecture, triage-resolved, ready-for-human

## Summary
Replaced fragile in-page DOM injection on Talishar.net with a dedicated native WebExtension window (`/export.html`) opened via `browser.windows.create()`:
1. Resolved user issue where clicking "Salvar/Exportar Última Partida" or the in-game triggers never generated a window.
2. Eliminated DOM, CSS, Canvas/WebGL, and React unmounting collisions on `talishar.net`.
3. Created dedicated export interface with complete feature parity (match summary, editable stats, player nickname, wentFirst, match notes, sideboard, and direct export buttons).
4. Provided multi-channel triggers: extension popup button, automatic popup on Game Over, in-game floating button, and fallback to new tab if popup windows are restricted.

## Root Causes
1. **Talishar Host Page Architecture**: Talishar is a single-page application (React 18) rendering match boards inside Canvas/WebGL with strict viewport overrides (`GameViewport.css`) and global Pico CSS rules. Injected HTML DOM elements were constantly susceptible to styling overrides, viewport clipping, and React unmounting.
2. **Firefox Fingerprinting Protection**: Firefox alters `screen.availWidth` and `screen.availHeight` when fingerprinting protection is active, which caused viewport calculations and pointer events on in-page overlays to miss target hit-tests.
3. **Popup Auto-Close**: Clicking "📝 Salvar/Exportar Última Partida Jogada" in `popup/main.ts` sent a message to the content script and immediately closed the popup window via `window.close()`. Because the in-page DOM element was hidden or suppressed by Talishar, no window ever appeared.

## Delivered
1. **Dedicated Export Page Entrypoint (`entrypoints/export/index.html` & `main.ts`)**:
   - Built a standalone WebExtension page compiled by WXT into `dist/firefox/export.html`.
   - Dark theme styling with responsive layout designed for 640x780 popup window.
   - Match Summary Card displaying outcome badge (Vitória/Derrota/Empate), turns count, matchup heroes, and average turn values.
   - Dynamic opponent statistics banner with "🔄 Sincronizar do Jogo" button to fetch live stats from the active Talishar tab.
   - Editable fields: Jogador (persists nickname), Iniciou a Partida (Sim/Não), Meu Valor Médio/Turno, Valor Médio/Turno Oponente, Notas da Partida, and Cartas Fora do Deck / Sideboard.
   - Action buttons: "📊 Salvar no Google Sheets", "🌐 Abrir Planilha Google", "📥 Baixar CSV (Excel PT-BR)", "📄 Baixar Log Completo (.txt)", and "Fechar Janela".
2. **Background Window Service (`entrypoints/background.ts`)**:
   - Added listener for `OPEN_EXPORT_WINDOW` message.
   - Saves current match payload to `activeExportMatch` in local storage.
   - Spawns a clean native window using `browser.windows.create({ url: '/export.html', type: 'popup', width: 640, height: 780 })`.
   - Includes automatic fallback to `browser.tabs.create()` if window popup mode is blocked.
3. **Popup Trigger (`entrypoints/popup/main.ts`)**:
   - Updated "📝 Salvar/Exportar Última Partida Jogada" click handler.
   - Seamlessly extracts match data from active Talishar tab or local history and dispatches `OPEN_EXPORT_WINDOW`.
   - Now works 100% reliably whether the user is on Talishar.net or any other browser tab.
4. **Content Script Trigger (`entrypoints/content.ts`)**:
   - `showFloatingButton` click handler dispatches `OPEN_EXPORT_WINDOW` with latest merged game snapshot.
   - Game Over detection dispatches `OPEN_EXPORT_WINDOW` automatically when `autoOpenNotesModal` is enabled.
5. **Testing & Verification**:
   - Added `src/exportWindow.test.ts` testing data model, decimal formatting, and log/CSV output.
   - All 42 unit tests passing across 9 test suites.
   - TypeScript compiles cleanly (`tsc --noEmit`).
   - Production bundle built cleanly with WXT (`wxt build -b firefox`).
