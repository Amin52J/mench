### Phase 3.3 — CPU lookahead & tuning ✅ `[hybrid]`

**Gate:** Playtest notes: CPUs capture humans and press home stretch; no obvious throw moves.

**Opus pass (`/implement-opus`):**

- [x] Design 1-ply / limited 2-ply evaluation (document in phase Notes) — spec landed in `src/game/ai/README.md` (lookahead section); search itself is Composer.
- [x] Threat detection: squares opponent can reach next turn — already shipped in phase 3.2 as `isCellThreatened` (`src/game/ai/score.ts`); design doc confirms lookahead reuses it without a new scan.
- [x] Tune weights; document in `src/game/ai/README.md` or phase Notes — `escapeBase` 40 → 30 applied in `score.ts`; validated with frozen-position regression tests.

**Composer pass (`/implement-composer`):**

- [x] Implement search per Opus design — `src/game/ai/search.ts` (`scoreMovesWithLookahead`, `SEARCH` constants); `chooseMove` maximizes composite score.
- [x] Cap think time (e.g. 50ms compute + display delay) — `SEARCH_TIME_BUDGET_MS` wall-clock in `search.ts`; cosmetic 300–800ms delay unchanged in `pickCpuThinkDelayMs`.
- [x] Regression tests on frozen positions — `src/game/ai/chooseMove.lookahead.test.ts` (six cases: escape vs reckless advance, yard-6 reply, exact finish, forfeit path, determinism, budget).

**Notes:** Tag is `[hybrid]` — do not use `/implement` for whole phase.

**Opus pre-work landed**

- Added `src/game/ai/README.md` — design spec for the shallow lookahead: 1-ply expected + pessimistic opponent reply (over dice 1..6), opt-in 2-ply own-roll follow-up gated on `TWO_PLY_BREADTH_CAP`, static prefilter to `LOOKAHEAD_BREADTH` candidates, and a `SEARCH_TIME_BUDGET_MS = 50` wall-clock cap. Pure functions only, deterministic given the existing injectable RNG; calls `applyMove`/`rollDice`/`getLegalMoves` from `rules.ts` and `scoreMove`/`isCellThreatened` from `score.ts` (no new primitives).
- Composite score formula:
  `total = scoreMove + OWN_FOLLOWUP_WEIGHT*ownFollowUp − REPLY_DISCOUNT*replyExpected − REPLY_PESSIMISM*replyPessimistic`
  with initial constants `LOOKAHEAD_BREADTH=4`, `TWO_PLY_BREADTH_CAP=6`, `REPLY_DISCOUNT=0.55`, `REPLY_PESSIMISM=0.20`, `OWN_FOLLOWUP_WEIGHT=0.30`. Mixed expected/pessimistic chosen because pure minimax over stochastic dice is incorrect (opponent doesn't choose their roll) and pure expectation misses single-die catastrophes.
- Threat-detection bullet is `[~]` because `isCellThreatened` already covers the requirement (`src/game/ai/score.ts:134`); README documents that the lookahead's opponent-reply enumeration is a strict refinement and no new threat scan is needed.
- Weight retune is `[~]` because applying `escapeBase` 40 → 30 in isolation would regress phase-3.2 tests that exercise the static heuristic without lookahead; Composer should change weights and add frozen-position tests in the same commit so regressions are contained.
- Verification (Composer, 2026-05-31): `pnpm check:types && pnpm check:lint && pnpm test && pnpm build` — all pass (66 tests).
