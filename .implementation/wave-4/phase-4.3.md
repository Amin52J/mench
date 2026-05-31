### Phase 4.3 — Lobby & online setup ✅ `[composer]`

**Gate:** Wave 4 acceptance test in `roadmap.mdc` (share link, multi-human join, 30s timer, one full turn cycle). ✅ Manual two-tab playtest with `pnpm dev` + `pnpm dev:worker` (2026-05-31).

**Goal:** User-facing online flow.

- [x] Home: Create game / Join with code
- [x] Copy link UI; display join code prominently
- [x] Pre-game setup synced (2–4 seats, human/cpu per seat, up to 4 remote humans) — host authoritative
- [x] Disconnect banner; reconnect within TTL
- [x] Host leave policy (end game or migrate host — pick one, document in `product.mdc`)
- [x] `room_notice` banners (leave / rejoin); auto-dismiss after 5s (`ROOM_NOTICE_DISMISS_MS`)

**Notes:** Link-only discovery; no public lobby.

**Key decisions earned here:**
- **Lobby lives in `src/features/lobby/`** (home, online room shell, lobby UI) per `architecture.mdc`; wire types in `src/game/online/protocol.ts` (`update_setup`, `start_game`, `lobby` broadcast, `resumeToken`, `RECONNECT_GRACE_MS` = 60s).
- **Host leave → promote:** after 60s host grace without reconnect, promote lowest-index connected human; if none remain, `room_closed` (`product.mdc`, `api-design.mdc`).
- **Unclaimed human seats → CPU** at `start_game` (`createGameFromMeta` in `worker/room.ts`).
- **Disconnect mid-game:** seat runs as CPU until `resumeToken` reclaim; `player_left` / `player_rejoined` notices broadcast to the room.
- **Invite URL:** `?room=<uuid>&join=<code>`; `sessionStorage` holds `resumeToken` per room for tab refresh.
- **Shared `Input`** added in `src/shared/ui/` for join form (conventions.mdc).
