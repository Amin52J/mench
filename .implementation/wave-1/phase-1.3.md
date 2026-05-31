### Phase 1.3 — Full rules engine ✅ `[opus]`

**Gate:** `pnpm test` green for full game scenarios in `product.mdc` (captures, sixes, three-sixes, exact finish, win). ✅ — `pnpm test` → 36/36 (2026-05-31).

**Goal:** Pure reducer/API: `createGame`, `rollDice`, `getLegalMoves`, `applyMove`, `isGameOver`.

- [x] Turn order, active player, dice value, consecutive sixes counter — `src/game/rules.ts` `GameState` + `passTurn`
- [x] Legal move generation (enter on 6, move, no overshoot home) — `tryComputeMove` in `src/game/rules.ts`
- [x] Captures with safe-square exemption — `findCaptureVictim` + `isSafeTrackIndex`
- [x] Extra turn on 6; three-sixes forfeit per `product.mdc` — `rollDice` + `applyMove`
- [x] Win detection when all four pieces finished — `playerHasWon` / `isGameOver`
- [x] Support 2–4 players (inactive colors omitted) — `createGame` validation + `createInitialBoardState`
- [x] `forfeitTurn` / timeout path for **30s timer** (advance to next player per rules) — `forfeitTurn`
- [x] Export `GameIntent` union for Worker reuse (`architecture.mdc`) — `GameIntent` + `applyIntent` dispatcher
- [x] Fixture-based tests: sample mid-game states, capture, win in one move — `src/game/rules.test.ts` (19 tests, fixture builder `placePieces`)

**Key decisions earned here:**

- Rules engine stays a single-file reducer at `src/game/rules.ts` (per `architecture.mdc:52`); no need to split until CPU work in wave 3.
- **Finish cell is a pile, not a square:** `home`/`HOME_FINISH_INDEX` accepts all four pieces of a color simultaneously. The "no stacking / no blockades" rule (`product.mdc:25`) is enforced everywhere _except_ the finish cell. Recorded here rather than mutating `product.mdc` because it's an implementation invariant, not a player-visible rule.
- **Safe squares protect from capture, not from co-residence.** Landing on a safe square occupied by an opponent is legal — the attacker just doesn't send them home. Same rule applies to start squares (which are members of `SAFE_TRACK_INDICES`).
- **No-legal-move on a 6 keeps the turn** (player rolls again, sixes counter persists), matching the spirit of "rolling 6 grants another roll" in `product.mdc:19`. A non-six with no legal move passes the turn.
- `forfeitTurn` is allowed in either phase so the 30s timer path is single-call regardless of whether the human rolled before timing out.

**Notes:**

- No `decisions.mdc` or `product.mdc` edits were required — the existing rules already covered the resolved questions; the finish-pile and safe-square-coresidence points above are engine-level interpretations consistent with the locked product rules.
- Verification (2026-05-31): `pnpm check:types` ✅, `pnpm check:lint` ✅, `pnpm test` ✅ (36/36), `pnpm build` ✅.
