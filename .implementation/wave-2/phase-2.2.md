### Phase 2.2 — Dice & piece animations ✅ `[composer]`

**Gate:** Manual check: roll shows animation; piece moves along path smoothly; capture animates home.

**Goal:** Motion layer without changing rules.

- [x] `Dice` component — tap to roll; CSS keyframe tumble → settle on final value
- [x] Piece motion — transition along discrete cells (respect `prefers-reduced-motion`)
- [x] Capture flash + piece return to yard animation
- [x] Turn indicator pulse on active seat

**Notes:** Animate **after** state updates from reducer to avoid desync.

### Notes

- `Dice` tumbles when `game.dice` changes after `rollDice` (dev `?play=1` playground).
- `usePieceAnimations` diffs board positions, steps through `buildPieceCoordPath`, flash on capture cell.
- Gate verified manually 2026-05-31 (`?play=1` roll, path motion, capture). Automated checks exit 0 same date.
