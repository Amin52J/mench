### Phase 1.3 — Full rules engine ⬜ `[opus]`

**Gate:** `pnpm test` green for full game scenarios in `product.mdc` (captures, sixes, three-sixes, exact finish, win).

**Goal:** Pure reducer/API: `createGame`, `rollDice`, `getLegalMoves`, `applyMove`, `isGameOver`.

- [ ] Turn order, active player, dice value, consecutive sixes counter
- [ ] Legal move generation (enter on 6, move, no overshoot home)
- [ ] Captures with safe-square exemption
- [ ] Extra turn on 6; three-sixes forfeit per `product.mdc`
- [ ] Win detection when all four pieces finished
- [ ] Support 2–4 players (inactive colors omitted)
- [ ] `forfeitTurn` / timeout path for **30s timer** (advance to next player per rules)
- [ ] Export `GameIntent` union for Worker reuse (`architecture.mdc`)
- [ ] Fixture-based tests: sample mid-game states, capture, win in one move

**Key decisions earned here:** Lock any rule tweaks in `product.mdc` + `decisions.mdc` O9 if tests reveal ambiguity.
