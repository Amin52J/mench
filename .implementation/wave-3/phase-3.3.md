### Phase 3.3 — CPU lookahead & tuning ⬜ `[hybrid]`

**Gate:** Playtest notes: CPUs capture humans and press home stretch; no obvious throw moves.

**Opus pass (`/implement-opus`):**

- [ ] Design 1-ply / limited 2-ply evaluation (document in phase Notes)
- [ ] Threat detection: squares opponent can reach next turn
- [ ] Tune weights; document in `src/game/ai/README.md` or phase Notes

**Composer pass (`/implement-composer`):**

- [ ] Implement search per Opus design
- [ ] Cap think time (e.g. 50ms compute + display delay)
- [ ] Regression tests on frozen positions

**Notes:** Tag is `[hybrid]` — do not use `/implement` for whole phase.
