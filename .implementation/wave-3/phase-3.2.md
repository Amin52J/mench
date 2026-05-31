### Phase 3.2 — CPU engine v1 ✅ `[opus]`

**Gate:** `pnpm test` for AI move selection on scripted positions; local playtest vs 3 CPUs completes without hang.

**Goal:** Competitive heuristics per `decisions.mdc` O7.

- [x] `src/game/ai/` — score moves: capture, threatened piece escape, progress, enter on 6, home approach
- [x] Choose among legal moves with weighted score; tie-break toward aggression
- [x] Auto-roll for CPU after delay (`product.mdc` think time)
- [x] Unit tests: prefers capture over neutral advance when both legal

**Notes:** No deep search yet — phase 3.3 adds lookahead.

**Key decisions earned here**

- AI lives in `src/game/ai/` with three modules: `score.ts` (pure heuristic), `chooseMove.ts` (legal-move maximizer with injectable RNG for deterministic tie-breaks), and `index.ts` (public surface + `pickCpuThinkDelayMs`).
- Heuristic weights (in `WEIGHTS`): capture 100, escape-from-threat 40 + along-track bonus, enter-from-yard 60, home-entry 45, home-advance 6/step, finish-landing 80, progress 1/step. Aggression tie-break is a `+0.01` nudge for capture/threat moves so equal-score paths favor offense.
- `isCellThreatened` checks dice 1..6 of every opponent piece via `advanceAlongTrack`; yard pieces only threaten their own start square (since they need a 6 to leave). Safe squares are never threatened — matches `board.ts` `SAFE_TRACK_INDICES`.
- CPU think delay randomized per `product.mdc` 300–800ms via `pickCpuThinkDelayMs(random)` instead of the phase-3.1 fixed 450ms.
- `useLocalGame` CPU effect now calls `chooseMove(snapshot)` instead of taking `moves[0]`; falls back to `forfeit` when no legal moves exist (e.g. a non-6 roll with all pieces in yard).
- No lookahead in this phase by design — phase 3.3 will layer shallow search on top of the same scoring functions (`decisions.mdc` O7).

**Verification:** `pnpm check:types && pnpm check:lint && pnpm test && pnpm build` exit 0 (2026-05-31). Test files: `src/game/ai/chooseMove.test.ts` (7 tests, all green) covering capture preference, escape-from-threat, exact-finish landing, enter-on-6 preference, null on empty legal set, scoreMove ordering, and `pickCpuThinkDelayMs` bounds.
