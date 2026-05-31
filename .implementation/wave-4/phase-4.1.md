### Phase 4.1 — Worker & Wrangler scaffold ⬜ `[composer]`

**Gate:** `wrangler dev` runs; `POST /api/rooms` returns room id; health endpoint OK.

**Goal:** Cloudflare Worker + first **Durable Object** (`GameRoom`) per `api-design.mdc`. Operator knows Pages/Workers; README explains DO in plain terms.

- [ ] `wrangler.toml` with DO binding + compatibility flags for free account
- [ ] `worker/index.ts`, `worker/room.ts` (DO stub: hello + echo state)
- [ ] Share `game` types with Worker build (duplicate tsconfig path or `tsup` bundle of `game/` only)
- [ ] `POST /api/rooms` creates DO id + join code
- [ ] CORS for local Vite origin in dev
- [ ] README section: Pages (SPA) vs Worker (API) vs DO (one room = one object), `wrangler login`, `wrangler dev`
- [ ] Document `pnpm dev:worker` (and how Vite proxy talks to local Worker)

**Notes:** No full game sync yet. Stay within free-tier defaults unless a limit blocks dev.
