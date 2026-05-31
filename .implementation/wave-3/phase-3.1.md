### Phase 3.1 — Player setup (human vs CPU) ⬜ `[composer]`

**Gate:** Can start any valid mix (e.g. 4 humans, 1 human + 3 CPU, 2+2) from New game setup.

**Goal:** Seat configuration before game starts per `product.mdc` and `decisions.mdc` O12.

- [ ] Setup UI: player count 2–4; per-seat toggle **Human** / **CPU**
- [ ] `PlayerKind` on game state: `human` | `cpu`
- [ ] Require ≥1 human to start (optional dev-only all-CPU bypass behind flag)
- [ ] Session loop skips input on CPU turns
- [ ] Quick-start presets optional (e.g. “Solo vs 3 CPU”)

**Notes:** No artificial cap on human count.
