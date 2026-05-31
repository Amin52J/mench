### Phase 3.2 — CPU engine v1 ⬜ `[opus]`

**Gate:** `pnpm test` for AI move selection on scripted positions; local playtest vs 3 CPUs completes without hang.

**Goal:** Competitive heuristics per `decisions.mdc` O7.

- [ ] `src/game/ai/` — score moves: capture, threatened piece escape, progress, enter on 6, home approach
- [ ] Choose among legal moves with weighted score; tie-break toward aggression
- [ ] Auto-roll for CPU after delay (`product.mdc` think time)
- [ ] Unit tests: prefers capture over neutral advance when both legal

**Notes:** No deep search yet — phase 3.3 adds lookahead.
