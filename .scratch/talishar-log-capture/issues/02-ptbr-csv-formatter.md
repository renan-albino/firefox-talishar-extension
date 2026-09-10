# 02: PT-BR CSV Formatter and Full Log Export

**What to build:**
A pure domain module `CsvFormatter` that formats `MatchRecord` instances into Brazilian Portuguese Excel-compatible CSV format (`\uFEFF` BOM UTF-8, semicolon `;` delimiter, escaped quotes) with average turn values, notes, and sideboard cards, plus raw log export.

**Blocked by:** 01-project-scaffolding

**Status:** resolved

- [x] Implement `formatMatchSummaryCsv(match: MatchRecord): string` with PT-BR Excel compatibility.
- [x] Implement `formatMatchHistoryCsv(matches: MatchRecord[]): string` for batch exports.
- [x] Implement `formatFullLogText(match: MatchRecord): string` for complete log download.
- [x] Write Vitest test suite testing escaping, semicolon delimiters, accents, BOM, and null values.

## Answer

Delivered `src/formatters/csvFormatter.ts` and `src/formatters/csvFormatter.test.ts`:
- Generates PT-BR Excel compatible CSV with UTF-8 BOM (`\uFEFF`), semicolon (`;`) delimiter, escaped quotes, and comma-formatted decimals.
- Supports single match export and multiple match history exports.
- Formats structured human-readable full match text logs.
- All unit tests passing in Vitest.
