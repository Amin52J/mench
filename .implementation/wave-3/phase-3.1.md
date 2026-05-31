### Phase 3.1 — Player setup (human vs CPU) ✅ `[composer]`

**Gate:** Can start any valid mix (e.g. 4 humans, 1 human + 3 CPU, 2+2) from New game setup.

**Goal:** Seat configuration before game starts per `product.mdc` and `decisions.mdc` O12.

- [x] Setup UI: player count 2–4; per-seat toggle **Human** / **CPU**
- [x] `PlayerKind` on game state: `human` | `cpu`
- [x] Require ≥1 human to start (optional dev-only all-CPU bypass behind flag)
- [x] Session loop skips input on CPU turns
- [x] Quick-start presets optional (e.g. “Solo vs 3 CPU”)

**Notes:** No artificial cap on human count.

**Key decisions earned here**

- `PlayerKind` lives in `src/game/types.ts` and is stored on `GameState.seatKinds` (parallel to `players`) so Worker and local session share the same shape.
- Session setup still uses `GameSetup` / `SeatConfig`; `seatKindsFromSetup` maps into `createGame` on start/restart.
- Dev all-CPU start: `?allCpu=1` in dev only (`devFlags.ts`).
- Quick presets: Solo vs 3 CPU, 2 humans + 2 CPU, 4 humans (`QUICK_SETUP_PRESETS`).
- CPU auto-play uses ~450ms delay in `useLocalGame` (phase 3.2 will improve move choice).

**Verification:** `pnpm check:types && pnpm check:lint && pnpm test && pnpm build` exit 0 (2026-05-31).
