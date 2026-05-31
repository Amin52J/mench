### Phase 4.2 — Real-time game sync 🟡 `[opus]`

**Gate:** Two browser tabs via `wrangler dev` stay in sync through roll + move + capture. _Pending manual two-tab playtest — automated harness left for phase 4.3._

**Goal:** Server-authoritative loop in Durable Object.

- [x] WebSocket upgrade routed to correct DO instance
- [x] `join` assigns seat; broadcast `state` with monotonic `seq`
- [x] Validate `intent` with shared `game` functions; CPU intents generated server-side for CPU seats
- [x] **30s turn timer** in DO: `turnDeadline`, auto skip-turn on expiry; expose remaining time in broadcasts (`api-design.mdc`)
- [x] Client `src/features/online/` — connect, dispatch intents, apply snapshots only; show server-synced countdown
- [~] Integration test or scripted wrangler test where feasible — `src/game/online/protocol.test.ts` covers the wire parser (11 cases); full WS round-trip needs Miniflare/Workerd harness, deferred to phase 4.3

**Key decisions earned here:**
- **Wire protocol lives in `src/game/online/protocol.ts`** (pure module, no React/DOM) so both the Worker (`@game/online/protocol.ts`) and `src/features/online/` import the same `ClientMessage`/`ServerMessage`/`PublicGameState` types. Keeps the layer rule in `architecture.mdc` (`features` and `worker` share via `game`) intact.
- **Seq gap handling:** the client `useOnlineGame` reducer ignores any `state` whose `seq` is ≤ the last accepted one (`useOnlineGame.ts:78`). The `welcome` snapshot always replaces local state. `applyServerIntent` only bumps `seq` on a successful engine transition — illegal intents return an `error` without a new `seq`. _Recorded in `api-design.mdc`._
- **Reconnect policy (v1):** disconnects free the seat immediately; reconnect = open a new socket and re-`join`. The new join takes the first free human seat — there's no resume yet. Phase 4.3 will add a short grace window and seat-by-token resume. _Recorded in `api-design.mdc`._
- **Turn timer = DO alarm.** `armTurnTimer` sets `state.storage.setAlarm(turnDeadline)`; `alarm()` forfeits through the shared `applyIntent({type:'forfeit'})`. Alarm is cleared on CPU turns and after `winner` is set so the timer can never fire mid-CPU-turn.
- **Server-side CPU driver** uses `chooseMove` from `@game/ai` plus a 450 ms think delay (`CPU_THINK_DELAY_MS`). It runs whenever `activeSeatKind === 'cpu'`, including the room's opening turn if seat 0 is CPU.
- **Connection seat freeing on disconnect:** simplest v1 behaviour; revisit when reconnect grace is added.

**Notes:**
- The DO preserves phase-4.1 stub routes (`/init`, `/hello`, `/state`, `/echo`) so the phase 4.1 smoke command still returns the same shape.
- `OnlineGameView` is intentionally minimal styling — phase 4.3 lobby will wrap it with join-by-code UI; rolling animation reuses the local `Dice` component.
- Vitest cannot evaluate `WebSocketPair` / Cloudflare DurableObject runtime; the integration test ticket is therefore wired through Miniflare in phase 4.3 (see `roadmap.mdc` wave 4 acceptance test 1).
