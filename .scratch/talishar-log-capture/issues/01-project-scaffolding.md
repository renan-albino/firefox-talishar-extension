# 01: Project scaffolding with WXT, TypeScript & Vitest

**What to build:**
A base WebExtension project configured with WXT for Firefox, TypeScript, Vitest for unit testing, and core domain data models (`MatchRecord`, `PlayerStats`).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Initialize `package.json` with dependencies (`wxt`, `typescript`, `vitest`).
- [x] Configure `wxt.config.ts` targeting Firefox with required permissions (`storage`, `downloads`, `*://*.talishar.net/*`).
- [x] Set up `tsconfig.json` and `vitest.config.ts`.
- [x] Define core TypeScript domain interfaces in `src/types/match.ts`.
- [x] Verify test runner executes cleanly with `npm test`.

## Answer

Scaffolding completed successfully:
- WXT configured for Firefox with permissions `storage`, `downloads` and host pattern `*://*.talishar.net/*`.
- TypeScript config extending WXT setup with strict mode.
- Vitest suite configured with Happy-DOM.
- Domain models defined in `src/types/match.ts`.
- Smoke test passing and build passing.
