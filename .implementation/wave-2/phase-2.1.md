### Phase 2.1 — Board UI & design tokens ⬜ `[composer]`

**Gate:** Board visible in browser; responsive at 360px width; `pnpm build` passes.

**Goal:** Minimal Ludo board render wired to read-only `BoardState`.

- [ ] `src/shared/styles/tokens.css` — classic Mench/Ludo four colors (red, green, yellow, blue), spacing, motion duration (`decisions.mdc` O15)
- [ ] `src/shared/ui/` — `Button`, `Panel` (minimal primitives for `execution.mdc`)
- [ ] `src/features/board/` — board layout (CSS grid or SVG), yards, track, home triangles
- [ ] Render pieces from state; highlight active player color
- [ ] Dev-only hook: load fixture state from `game` tests for visual check

**Notes:** No networking. No CPU yet.
