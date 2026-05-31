## CPU AI — design notes

Source-of-truth for the smart CPU profile (`decisions.mdc` O7, O17).
Phase 3.2 shipped the heuristic baseline. Phase 3.3 layers a **shallow
lookahead** on top of the same scoring functions; this document is the
Opus-side spec that Composer implements in the same phase.

### Scope reminder

- **No deep search.** v1 ships a single "smart" profile (O17) within a
  hard compute budget (~50ms — phase 3.3 gate). Anything that doesn't
  fit the budget is out of scope.
- **Pure functions only.** AI must remain a side-effect-free wrapper
  over `rules.ts` (`getLegalMoves`, `applyMove`); no React, no timers,
  no DO state. Think delay is product-layer (`pickCpuThinkDelayMs`,
  300–800ms per `product.mdc`).
- **Deterministic given a seeded RNG.** All tie-breaks route through
  the injectable `random` in `ChooseMoveOptions`. Frozen-position
  regression tests rely on this.

---

### Existing primitives (phase 3.2, do not re-derive)

| Symbol | File | Role |
| --- | --- | --- |
| `scoreMove(state, move)` | `score.ts` | Static heuristic on one ply. |
| `scoreMoves(state, moves)` | `score.ts` | Vectorized wrapper. |
| `isCellThreatened(state, defender, trackIndex)` | `score.ts` | Threat detection: any opponent piece able to reach `trackIndex` with a 1..6 roll on their next turn. Safe squares always return `false`. Yard pieces only threaten their own start square. |
| `WEIGHTS` | `score.ts` | Tunable weights table. |
| `chooseMove(state, options?)` | `chooseMove.ts` | Top-level legal-move maximizer with stable RNG tie-break. |

The lookahead **does not replace** these. It calls them.

---

### Lookahead design

#### 1-ply (always on)

For each candidate `LegalMove` `m` of the active player:

1. `next = applyMove(state, m.piece)` — produces the post-move state
   that's now sitting in the next seat's `roll_dice` phase (or our own,
   if `m` rolled a 6 and we earned the extra turn — `rules.ts` already
   handles that transition).
2. Evaluate the **opponent's worst-case reply** over their six possible
   die outcomes:
   - For each `die ∈ 1..6`:
     - `afterRoll = rollDice(next, die)` — pure, deterministic.
     - Enumerate `getLegalMoves(afterRoll)`.
     - Their static score is `max(scoreMove(afterRoll, r) for r in replies)`
       (treat empty legal set as `0` — they'll forfeit, which is
       neutral from their POV and fine from ours).
   - The expected reply value is `(1/6) * Σ replyScore(die)`.
   - The pessimistic reply value is `max replyScore(die)`.
3. Composite score:

   ```
   total(m) = scoreMove(state, m)                       // own gain
            - REPLY_DISCOUNT * replyExpected(m)         // they gain back
            - REPLY_PESSIMISM * replyPessimistic(m)     // worst-case dread
   ```

   Both terms are **subtracted** because they measure the opponent's
   upside, which is symmetrically our downside. Pessimism term is small
   (a tie-breaker against moves that hand the opponent a free capture
   on a single specific roll).

**Why mixed expected + pessimistic?** Pure minimax over a stochastic
die is wrong (the opponent doesn't choose their roll). Pure expectation
ignores the catastrophic "you parked next to the red start on a 6"
case. The mix is the cheap fix.

#### Limited 2-ply (opt-in, budget permitting)

Only triggered when `getLegalMoves(state).length <= TWO_PLY_BREADTH_CAP`
(default cap: **6 moves**, see budget below). For each surviving
candidate after 1-ply scoring, simulate **our** next dice roll too:

```
ownFollowUp(m) = (1/6) * Σ_die max(scoreMove(after, r) for r in getLegalMoves(after))
   where after = rollDice(applyMove(state, m).maybeUs, die)
```

`maybeUs` accounts for the six-grants-extra-turn rule: if `next` is
already our turn (we rolled a 6), the 2-ply branch evaluates that
extra turn directly with no opponent reply layered in.

Final composite:

```
total(m) = scoreMove(state, m)
         + OWN_FOLLOWUP_WEIGHT * ownFollowUp(m)
         - REPLY_DISCOUNT     * replyExpected(m)
         - REPLY_PESSIMISM    * replyPessimistic(m)
```

2-ply is **strictly the same heuristic, deeper**. We never recurse
beyond depth 2 in v1.

#### Pruning & budget

- **Static prefilter.** Sort candidates by `scoreMove` desc, keep the
  top `LOOKAHEAD_BREADTH` (default **4**). Cheap moves that already
  lose on static evaluation never get expanded.
- **Hard wall-clock check.** Composer wraps the search in a
  `performance.now()` budget (target ≤ 50ms compute, separate from the
  300–800ms cosmetic delay). If the budget elapses mid-expansion,
  return the best 1-ply result computed so far. Determinism is
  preserved because the static prefilter order is stable.
- **Worst-case fanout.** 1-ply: `breadth * 6 dice * ≤4 reply moves` ≈
  `4 * 6 * 4 = 96` `scoreMove` calls + simulations. 2-ply opt-in adds
  another `breadth * 6 * 4 ≈ 96`. Well under 50ms in V8 for our state
  size (16 pieces, 40 track cells).

#### Constants (initial values — Composer wires them)

```ts
LOOKAHEAD_BREADTH       = 4    // top-N candidates expanded past 1-ply scoring
TWO_PLY_BREADTH_CAP     = 6    // skip 2-ply if more than this many legal moves
REPLY_DISCOUNT          = 0.55 // weight on opponent's expected reply
REPLY_PESSIMISM         = 0.20 // weight on opponent's worst single-die reply
OWN_FOLLOWUP_WEIGHT     = 0.30 // weight on our 2-ply expectation
SEARCH_TIME_BUDGET_MS   = 50
```

These ship as `SEARCH` constants alongside `WEIGHTS` so they're
tweakable from one place.

---

### Threat detection

Already implemented as `isCellThreatened` in `score.ts`. The lookahead
**does not** need its own threat scan — the opponent reply enumeration
covers the same information more precisely (we see exactly which die
captures us, not just "some die might"). `isCellThreatened` stays as
the static-score primitive for the escape-threat term.

No changes required for phase 3.3 beyond what's already in `score.ts`.

---

### Weight retune (phase 3.3)

Phase 3.2 weights were calibrated against the static heuristic only.
With lookahead now seeing opponent captures explicitly, two weights
should soften so the search isn't double-counting them:

| Weight | 3.2 value | 3.3 proposal | Rationale |
| --- | --- | --- | --- |
| `escapeBase` | 40 | **30** | Search now penalizes leaving a threatened piece via `REPLY_*` terms; the static escape bonus only needs to break ties when search is pruned out. |
| `aggressionTieBreak` | 0.01 | **0.01** (keep) | Stays as a static-only nudge; lookahead has its own tie-break via `total(m)`. |
| `progress` | 1 | **1** (keep) | Still the right magnitude for static disambiguation. |
| `homeAdvance` | 6 | **6** (keep) | Home-column moves are unaffected by opponent replies (safe by construction). |

All other `WEIGHTS` entries unchanged. Validate via the frozen-position
regression suite Composer adds — if any of those positions regress,
revisit `escapeBase` first.

---

### Test strategy (Composer)

1. **Frozen positions** — at least four hand-crafted `GameState`
   snapshots covering:
   - capture-vs-escape trade-off,
   - "looks safe but opponent has a 6 onto our start" (2-ply gotcha),
   - exact-finish vs aggressive capture,
   - all-pieces-in-yard non-6 (forfeit path).
2. **Determinism** — same seed ⇒ same move across 100 invocations.
3. **Budget** — synthetic state with max-fanout (4 pieces all on
   track, multi-capture options) must return under
   `SEARCH_TIME_BUDGET_MS * 2` even with profiling overhead.

---

### Out of scope (v1)

- Opponent modelling beyond the heuristic (no separate "opponent
  weights"). The opponent is assumed to use the same `scoreMove`.
- Search depth ≥ 3.
- Alpha-beta or any pruning beyond the static prefilter — the chance
  branching factor (6 dice) makes alpha-beta a poor fit here.
- Per-difficulty profiles (O17 — single profile in v1).
