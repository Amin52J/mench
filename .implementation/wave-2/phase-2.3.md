### Phase 2.3 — Local hotseat session ⬜ `[composer]`

**Gate:** Full local game with chosen Human/CPU mix; 30s timer forfeits idle human turn.

**Goal:** End-to-end local play using rules engine + board UI.

- [ ] `src/features/session/` — `useLocalGame` reducer wrapping `game` API
- [ ] New game setup: player count 2–4, Human/CPU per seat (or defer full setup UI to 3.1 if split — minimum 2–4 all-human path must work here)
- [ ] **Turn timer:** 30s countdown for human seats; skip turn on expiry (`decisions.mdc` O14)
- [ ] Flow: roll → highlight legal moves → tap piece → apply → next turn / extra turn
- [ ] Win overlay + restart
- [ ] Illegal tap feedback (shake or toast)

**Acceptance:** Matches wave 2 acceptance test in `roadmap.mdc`.
