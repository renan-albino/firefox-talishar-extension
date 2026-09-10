# 03: Google Apps Script Webhook Client and Settings

**What to build:**
A persistent configuration mechanism (popup/options) storing the user's Google Apps Script Webhook URL in `browser.storage.local`, an HTTP client that sends match payloads via POST, and a ready-to-use `Code.gs` template for the Google Sheet.

**Blocked by:** 01-project-scaffolding

**Status:** resolved

- [x] Provide `google-apps-script/Code.gs` script with copy-paste instructions for the user's Google Sheet.
- [x] Implement `SheetsClient` to serialize and send `MatchRecord` via POST to the configured Webhook URL.
- [x] Implement settings storage helper in `src/utils/storage.ts`.
- [x] Create extension Popup / Options page with input for the Webhook URL and a "Test Connection" button.
- [x] Unit tests for `SheetsClient` payload creation and network response handling.

## Answer

Delivered:
- `google-apps-script/Code.gs` containing full Webhook receiver code with automatic header creation and PING support.
- `src/services/sheetsClient.ts` with `sendMatchToSheets` and `testSheetsConnection`.
- `src/utils/storage.ts` for managing settings and match history using `wxt/storage`.
- Extension popup UI with Webhook URL input, connection tester, and auto-open preferences.
- All unit tests passing in Vitest.
