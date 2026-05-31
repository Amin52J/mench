### Phase 2.3 — Local hotseat session ✅ `[composer]`

**Gate:** Full local game with chosen Human/CPU mix; 30s timer forfeits idle human turn.

**Goal:** End-to-end local play using rules engine + board UI.

- [x] `src/features/session/` — `useLocalGame` reducer wrapping `game` API
- [x] New game setup: player count 2–4, Human/CPU per seat (or defer full setup UI to 3.1 if split — minimum 2–4 all-human path must work here)
- [x] **Turn timer:** 30s countdown for human seats; skip turn on expiry (`decisions.mdc` O14)
- [x] Flow: roll → highlight legal moves → tap piece → apply → next turn / extra turn
- [x] Win overlay + restart
- [x] Illegal tap feedback (shake or toast)

**Acceptance:** Matches wave 2 acceptance test in `roadmap.mdc`.

### Notes

- `useLocalGame` + `localGameReducer` wrap `rollDice` / `applyMove` / `forfeitTurn`; CPU seats auto-play with first legal move (smart AI deferred to wave 3).
- `BoardView` accepts tappable pieces (`data-legal`, shake) during human move phase.
- Gate verified 2026-05-31: `pnpm check:types`, `pnpm check:lint`, `pnpm test` (49), `pnpm build` exit 0.
