# 06: Post-Match Trigger Button, Notes Modal and End-to-End Export

**What to build:**
End-to-end integration: upon match completion, render a floating trigger button that opens a post-match modal with editable pre-filled fields (heroes, result, average turn values, sideboard cards) and a textarea for Match Notes. Provide export actions for Google Sheets, local PT-BR CSV, and raw log download.

**Blocked by:** 02-ptbr-csv-formatter, 03-google-apps-script-webhook, 04-talishar-dom-parser, 05-pregame-deck-sideboard-tracker

**Status:** ready-for-agent

- [ ] Injected floating button that appears on match finish.
- [ ] Post-match modal with:
  - Editable Match Notes textarea.
  - Editable Sideboard / Cards Left Out input.
  - Pre-filled summary: Winner/Loser, Turns, Player Avg Turn Value, Opponent Avg Turn Value.
- [ ] Action buttons:
  - "Salvar no Google Sheets" (via Webhook).
  - "Baixar CSV (Excel PT-BR)" (via browser download).
  - "Baixar Log Completo (.txt)" (via browser download).
- [ ] Visual success/error feedback toasts in the modal.
