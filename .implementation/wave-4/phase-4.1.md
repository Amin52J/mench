### Phase 4.1 — Worker & Wrangler scaffold ✅ `[composer]`

**Gate:** `wrangler dev` runs; `POST /api/rooms` returns room id; health endpoint OK. Verified 2026-05-31 (`pnpm exec wrangler dev` + `Invoke-RestMethod` on `/api/health` and `POST /api/rooms`).

**Goal:** Cloudflare Worker + first **Durable Object** (`GameRoom`) per `api-design.mdc`. Operator knows Pages/Workers; README explains DO in plain terms.

- [x] `wrangler.toml` with DO binding + compatibility flags for free account
- [x] `worker/index.ts`, `worker/room.ts` (DO stub: hello + echo state)
- [x] Share `game` types with Worker build (duplicate tsconfig path or `tsup` bundle of `game/` only)
- [x] `POST /api/rooms` creates DO id + join code
- [x] CORS for local Vite origin in dev
- [x] README section: Pages (SPA) vs Worker (API) vs DO (one room = one object), `wrangler login`, `wrangler dev`
- [x] Document `pnpm dev:worker` (and how Vite proxy talks to local Worker)

**Notes:** No full game sync yet. Stay within free-tier defaults unless a limit blocks dev.

**Key decisions earned here:**
- `tsconfig.worker.json` includes `worker/` + `src/game/` with `@game/*` path alias (no separate bundle).
- DO stub routes: `/init`, `/hello`, `/state`, `/echo` on internal `http://game-room/*` requests.
- Vite proxies `/api` → `http://127.0.0.1:8787` in dev; CORS allows `localhost:5173` and `127.0.0.1:5173`.
- `GameIntent` imported in `worker/room.ts` as `RoomIntent` to prove shared types; dispatch deferred to 4.2.
