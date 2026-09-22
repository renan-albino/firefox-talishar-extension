# Issue 08: Opponent Stats, Equipment, AI Logs & Google Sheets Enhancements

**Status**: Completed
**Labels**: feature, performance, bug, triage-resolved, ready-for-human

## Summary
Addressed user requests regarding column customization, opponent statistics capture, equipment tracking, AI-optimized combat logs, performance optimizations, and Google Sheets webhook connection handling:
1. **Google Sheets Columns & Match Field**: Reordered columns according to user preference, and adjusted the "Match" column to record only the opponent's hero (`Dorinthea Ironsong`) instead of repeating both heroes (`Kayo vs Dorinthea`).
2. **AI-Ready Full Log (.txt)**: Implemented `replacePlayerNamesWithHeroes` so combat logs replace screen usernames with character/hero names (e.g. *Kayo played Wild Ride*, *Dorinthea blocked with Ironrot Gauntlet*).
3. **Equipment Tracking & Card Pitch Colors**: Added `parseEquipment` to capture equipped gear (head, chest, arms, legs, weapons) and pitch color tags `(1 - Vermelha)`, `(2 - Amarela)`, `(3 - Azul)`.
4. **Fast Opponent Average Turn Value Capture**: Added multi-delay polling on tab clicks (50ms, 150ms, 400ms) and on the "👆 Alternar no Jogo" button, plus editable inputs in the export modal.
5. **Fixed Firefox CPU Lag ("Slowing down Firefox")**: Debounced page state checks to 500ms, filtered out internal extension mutations, and parsed combat logs strictly on-demand.
6. **Fixed "Testar Conexão" Hanging**: Added 12s `AbortController` timeout, immediate link validation, instant PING response in `Code.gs` prior to opening sheets, and background script routing with `<all_urls>` host permissions.
7. **Floating Button Styling**: Corrected `left: auto !important;` and `width: auto !important;` in `floatingButton.ts` to prevent Talishar's global button CSS from stretching it across the screen.

## Verification
- Vitest: 7 test suites, 34 passed.
- WXT build (`wxt build -b firefox`): built successfully without warnings.
- Packaged release zip: `dist/firefox-talishar.zip`.
