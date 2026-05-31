### Phase 2.2 — Dice & piece animations ⬜ `[composer]`

**Gate:** Manual check: roll shows animation; piece moves along path smoothly; capture animates home.

**Goal:** Motion layer without changing rules.

- [ ] `Dice` component — tap to roll; CSS keyframe tumble → settle on final value
- [ ] Piece motion — transition along discrete cells (respect `prefers-reduced-motion`)
- [ ] Capture flash + piece return to yard animation
- [ ] Turn indicator pulse on active seat

**Notes:** Animate **after** state updates from reducer to avoid desync.
