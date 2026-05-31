### Phase 2.1 — Board UI & design tokens ✅ `[composer]`

**Gate:** Board visible in browser; responsive at 360px width; `pnpm build` passes.

**Goal:** Minimal Ludo board render wired to read-only `BoardState`.

- [x] `src/shared/styles/tokens.css` — classic Mench/Ludo four colors (red, green, yellow, blue), spacing, motion duration (`decisions.mdc` O15)
- [x] `src/shared/ui/` — `Button`, `Panel` (minimal primitives for `execution.mdc`)
- [x] `src/features/board/` — board layout (CSS grid or SVG), yards, track, home triangles
- [x] Render pieces from state; highlight active player color
- [x] Dev-only hook: load fixture state from `game` tests for visual check

**Notes:** No networking. No CPU yet.

### Notes

- Track/home/yard grid coords use a standard 15×15 path with offset so engine track index `0` is red's start; see `boardLayout.test.ts`.
- Fixture builders moved to `src/game/fixtures.ts` (shared by `rules.test.ts` and dev `?fixture=` hook).
- Gate verified 2026-05-31: `pnpm check:types`, `pnpm check:lint`, `pnpm test`, `pnpm build` exit 0.
