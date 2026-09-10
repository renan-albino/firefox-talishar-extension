# 03: Google Apps Script Webhook Client and Settings

**What to build:**
A persistent configuration mechanism (popup/options) storing the user's Google Apps Script Webhook URL in `browser.storage.local`, an HTTP client that sends match payloads via POST, and a ready-to-use `Code.gs` template for the Google Sheet.

**Blocked by:** 01-project-scaffolding

**Status:** ready-for-agent

- [ ] Provide `google-apps-script/Code.gs` script with copy-paste instructions for the user's Google Sheet.
- [ ] Implement `SheetsClient` to serialize and send `MatchRecord` via POST to the configured Webhook URL.
- [ ] Implement settings storage helper in `src/utils/storage.ts`.
- [ ] Create extension Popup / Options page with input for the Webhook URL and a "Test Connection" button.
- [ ] Unit tests for `SheetsClient` payload creation and network response handling.
