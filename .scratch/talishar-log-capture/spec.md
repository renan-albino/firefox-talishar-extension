# Spec: Talishar Log Capture & Exporter for Firefox

Status: ready-for-agent

## Problem Statement

Players of Flesh and Blood (FaB) using the online web platform Talishar.net currently lack an automated, non-intrusive way to record match outcomes, tactical statistics (such as Average Turn Value for both players), deck adjustments (sideboard changes and sub-60 card main deck variations), and personal reflections/notes after each match. Copying combat logs manually is tedious, prone to data loss if the browser tab is closed, and formatting data for personal spreadsheets (specifically Microsoft Excel in Brazilian Portuguese or remote Google Sheets) requires manual repetitive work.

## Solution

A Firefox WebExtension developed with WXT and TypeScript that:
1. Runs silently in the background on `talishar.net`.
2. Observes and aggregates the combat log, match participants, heroes, and in-game statistics (specifically Average Turn Value for both players).
3. Detects pre-game deck/sideboard adjustments (tracking cards swapped out or left out of the main deck).
4. Displays a non-intrusive floating action button at the end of the match that opens a post-match modal.
5. Allows the user to enter Match Notes and adjust detected sideboard cards before exporting.
6. Delivers exports directly to:
   - **Local CSV** formatted specifically for Brazilian Portuguese Excel (`\uFEFF` UTF-8 BOM, `;` delimiter, quoted strings).
   - **Remote Google Sheets** via a simple Google Apps Script Webhook URL (configured in the extension popup/options).
   - **Full Match Log** download in raw `.txt` or structured `.json` for granular review.

## User Stories

1. As a competitive player, I want the extension to automatically identify my hero and my opponent's hero on Talishar, so that I don't have to manually type them into my tracking sheet.
2. As a player adjusting my deck for specific matchups, I want the extension to detect and record cards that were swapped out or left out of my main deck (especially when below 60 cards), so that I can evaluate which sideboard plans performed best.
3. As an analytical player, I want the extension to capture the Average Turn Value displayed by Talishar for both myself and my opponent, so that I can quantify tempo and efficiency across turns.
4. As a player finishing an intense game, I want a floating button or banner to appear when the match ends rather than an aggressive modal popup, so that I can read the final combat log or chat with my opponent without interruption.
5. As a player reflecting on my performance, I want clicking the finish button to open a modal with a text field for Match Notes, so that I can write down key misplays, opposing deck variations, and strategic insights immediately while fresh in mind.
6. As a user who wants full control over data accuracy, I want the post-match modal to show pre-filled fields (heroes, result, average turn values, detected sideboard cards) with the ability to edit any field before submitting, so that I can correct any detection inconsistencies.
7. As a Brazilian Excel user, I want exporting to local CSV to generate a file with UTF-8 BOM (`\uFEFF`) and semicolon (`;`) delimiters, so that double-clicking the file in Excel opens columns cleanly without scrambled accents or broken numbers.
8. As a spreadsheet user tracking a tournament run, I want each exported match to generate a single summary row in my CSV, so that I can easily append games into my season tracking sheet.
9. As a coach or deep analyzer, I want an option to download the full action-by-action combat log as a text or JSON file, so that I can review turn sequences in detail.
10. As a Google Sheets user, I want to save a Google Apps Script Webhook URL in the extension popup, so that every completed match can be sent with one click directly into my Google Sheet in the cloud.
11. As a privacy-conscious user, I want all data extraction to occur locally in my browser without third-party tracking or external server dependencies.

## Implementation Decisions

### Modules & Architecture
- **Framework**: Built with **WXT** targeting Firefox (`manifest.json` v3/v2 support with TypeScript).
- **Core Domain Modules**:
  - `TalisharParser`: Pure extraction logic taking DOM elements / selectors to retrieve player names, hero names, current match turn, winner/loser state, and Average Turn Value counters.
  - `DeckAdjustmentTracker`: Intercepts/observes pre-game deck selection and equipment confirmation to capture sideboard configuration.
  - `CsvFormatter`: Formats a `MatchRecord` into a PT-BR compliant CSV string (`\uFEFF`, `;` separated, quoted text, proper decimal commas if needed).
  - `SheetsClient`: Dispatches a `fetch` POST request containing the `MatchRecord` JSON payload to the configured Google Apps Script Webhook URL.
  - `PostMatchModal`: Injected UI component (Shadow DOM / scoped styles) rendering the floating trigger button and the notes modal.
  - `ExtensionStorage`: Wrapper around `browser.storage.local` to store user settings (Google Sheets webhook URL, export preferences, local match history).

### Data Schema (`MatchRecord`)
```typescript
interface MatchRecord {
  id: string;
  timestamp: string; // ISO-8601
  player: {
    name: string;
    hero: string;
    avgTurnValue?: number;
  };
  opponent: {
    name: string;
    hero: string;
    avgTurnValue?: number;
  };
  result: 'win' | 'loss' | 'draw' | 'unknown';
  turnsCount: number;
  sideboardCards: string[]; // Cards left out or swapped
  notes: string;
  logSummary?: string;
}
```

### Architectural Decisions (ADRs)
- ADR 0001: WXT framework for Firefox extension development.
- ADR 0002: Google Apps Script Webhook URL for Google Sheets export.
- ADR 0003: PT-BR formatted CSV (`\uFEFF`, `;` delimiter, escaped quotes).

## Testing Decisions

- **Testing Seams**:
  - Seam 1: `CsvFormatter` tests verifying CSV escaping, PT-BR BOM header, semicolon delimiters, and empty notes handling.
  - Seam 2: `TalisharParser` tests running against mock HTML snapshots of Talishar game boards, extracting players, heroes, combat log items, and average turn values.
  - Seam 3: `SheetsClient` tests verifying JSON payload structure, error handling, and timeout behavior.
  - Seam 4: `DeckAdjustmentTracker` tests verifying deck size calculation and sideboard diffing.
- **Tools**: Vitest for fast, isolated unit and integration testing without launching browser instances for pure domain modules.

## Out of Scope

- Reverse engineering Talishar's internal WebSocket protocols or backend APIs.
- Automatic gameplay actions or bot functionality (extension is strictly read-only logging and export).
- Complex multi-account Google Cloud OAuth2 flows.

## Further Notes

- Webhook script code (`Code.gs`) for Google Apps Script will be included directly in documentation for copy-pasting into Google Sheets.
