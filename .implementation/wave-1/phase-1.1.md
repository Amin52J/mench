### Phase 1.1 — Project scaffold ✅ `[composer]`

**Gate:** `pnpm dev` serves placeholder; `pnpm check:types`, `pnpm check:lint`, `pnpm build` exit 0. Verified 2026-05-31 (all exit 0; dev server served placeholder on :5173).

**Goal:** Vite + React + TypeScript + CSS Modules + pnpm; folder layout per `architecture.mdc`.

- [x] Init `package.json` with pnpm; add `.npmrc` if needed (`shamefully-hoist` only if required)
- [x] Vite React-TS template; strict `tsconfig`
- [x] Path alias `@/` → `src/`, `@game/` → `src/game/`
- [x] ESLint + Prettier + scripts: `dev`, `build`, `check:types`, `check:lint`, `test`
- [x] Vitest configured
- [x] Create empty dirs: `src/game/`, `src/features/`, `src/shared/`, `worker/`
- [x] Placeholder `App` + minimal `README.md` (install, dev, scripts)
- [x] `.gitignore` for `node_modules`, `dist`, `.wrangler`

**Notes:** No game logic yet. Wrangler stub optional here or in 4.1. No `.npmrc` — default pnpm hoisting sufficient. React 19 + Vite 6 + Vitest 3 + ESLint 9 flat config. Empty dirs tracked via `.gitkeep`. `public/` added for static assets.
