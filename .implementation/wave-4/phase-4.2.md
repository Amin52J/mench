### Phase 4.2 — Real-time game sync ⬜ `[opus]`

**Gate:** Two browser tabs via `wrangler dev` stay in sync through roll + move + capture.

**Goal:** Server-authoritative loop in Durable Object.

- [ ] WebSocket upgrade routed to correct DO instance
- [ ] `join` assigns seat; broadcast `state` with monotonic `seq`
- [ ] Validate `intent` with shared `game` functions; CPU intents generated server-side for CPU seats
- [ ] **30s turn timer** in DO: `turnDeadline`, auto skip-turn on expiry; expose remaining time in broadcasts (`api-design.mdc`)
- [ ] Client `src/features/online/` — connect, dispatch intents, apply snapshots only; show server-synced countdown
- [ ] Integration test or scripted wrangler test where feasible

**Key decisions earned here:** Reconnect policy, seq gap handling — update `api-design.mdc` if changed.
