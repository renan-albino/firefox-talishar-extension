# 02: PT-BR CSV Formatter and Full Log Export

**What to build:**
A pure domain module `CsvFormatter` that formats `MatchRecord` instances into Brazilian Portuguese Excel-compatible CSV format (`\uFEFF` BOM UTF-8, semicolon `;` delimiter, escaped quotes) with average turn values, notes, and sideboard cards, plus raw log export.

**Blocked by:** 01-project-scaffolding

**Status:** ready-for-agent

- [ ] Implement `formatMatchSummaryCsv(match: MatchRecord): string` with PT-BR Excel compatibility.
- [ ] Implement `formatMatchHistoryCsv(matches: MatchRecord[]): string` for batch exports.
- [ ] Implement `formatFullLogText(match: MatchRecord): string` for complete log download.
- [ ] Write Vitest test suite testing escaping, semicolon delimiters, accents, BOM, and null values.
