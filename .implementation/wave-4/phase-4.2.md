### Phase 4.2 — Real-time game sync ✅ `[opus]`

**Gate:** Two browser tabs via `wrangler dev` stay in sync through roll + move + capture. ✅ Manual two-tab playtest (2026-05-31).

**Goal:** Server-authoritative loop in Durable Object.

- [x] WebSocket upgrade routed to correct DO instance
- [x] `join` assigns seat; broadcast `state` with monotonic `seq`
- [x] Validate `intent` with shared `game` functions; CPU intents generated server-side for CPU seats
- [x] **30s turn timer** in DO: `turnDeadline`, auto-play human turn on expiry (CPU heuristics, seat stays human); expose remaining time in broadcasts (`api-design.mdc`)
- [x] Client `src/features/online/` — connect, dispatch intents, apply snapshots only; show server-synced countdown
- [x] Wire parser tests — `src/game/online/protocol.test.ts`; full WS round-trip deferred (Miniflare harness not in v1)

**Key decisions earned here:**
- **Wire protocol lives in `src/game/online/protocol.ts`** (pure module, no React/DOM) so both the Worker (`@game/online/protocol.ts`) and `src/features/online/` import the same `ClientMessage`/`ServerMessage`/`PublicGameState` types. Keeps the layer rule in `architecture.mdc` (`features` and `worker` share via `game`) intact.
- **Seq gap handling:** the client `useOnlineGame` reducer ignores any `state` whose `seq` is ≤ the last accepted one (`useOnlineGame.ts`). The `welcome` snapshot always replaces local state. `applyServerIntent` only bumps `seq` on a successful engine transition — illegal intents return an `error` without a new `seq`. _Recorded in `api-design.mdc`._
- **Turn timer = DO alarm.** `armTurnTimer` sets `state.storage.setAlarm(turnDeadline)`; `alarm()` runs `playTimerTurn()` (CPU auto-play for timed-out human seats). Alarm cleared on CPU-only turns and after `winner` is set.
- **Server-side CPU driver** uses `chooseMove` from `@game/ai` plus a 450 ms think delay (`CPU_THINK_DELAY_MS`). It runs whenever `activeSeatKind === 'cpu'`, including substitute play when a human disconnects mid-game.

**Notes:**
- The DO preserves phase-4.1 stub routes (`/init`, `/hello`, `/state`, `/echo`) so the phase 4.1 smoke command still returns the same shape.
- Reconnect grace and `room_notice` presence events landed in phase 4.3.
