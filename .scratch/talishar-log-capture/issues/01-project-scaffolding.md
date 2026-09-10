# 01: Project scaffolding with WXT, TypeScript & Vitest

**What to build:**
A base WebExtension project configured with WXT for Firefox, TypeScript, Vitest for unit testing, and core domain data models (`MatchRecord`, `PlayerStats`).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Initialize `package.json` with dependencies (`wxt`, `typescript`, `vitest`).
- [ ] Configure `wxt.config.ts` targeting Firefox with required permissions (`storage`, `downloads`, `*://*.talishar.net/*`).
- [ ] Set up `tsconfig.json` and `vitest.config.ts`.
- [ ] Define core TypeScript domain interfaces in `src/types/match.ts`.
- [ ] Verify test runner executes cleanly with `npm test`.
