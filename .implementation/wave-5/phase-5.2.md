### Phase 5.2 — Production deploy ✅ `[composer]`

**Gate:** Production URL smoke test passes `roadmap.mdc` wave 5 acceptance.

**Goal:** Wrangler production deploy for SPA + Worker.

- [x] `pnpm deploy` script wiring `wrangler deploy` + client build
- [x] Production env in `wrangler.toml` (routes, DO bindings)
- [x] README: deploy steps, required Cloudflare account setup
- [x] Smoke checklist: create room, join from phone, play one turn

**Notes:** Custom domain optional follow-up.

### Notes (implementation)

- Unified deploy: Worker + `[assets]` from `dist/` (same origin as `/api/*`). `worker/index.ts` serves non-API via `env.ASSETS`.
- `[env.production]` duplicates `durable_objects`, `migrations`, and `assets` (Wrangler does not inherit DO bindings into envs).
- CORS: same-host `Origin` allowed in addition to Vite dev origins (`worker/cors.ts`).
- **Verify (2026-05-31):** `pnpm check:types`, `check:lint`, `test`, `build` exit 0; `wrangler deploy --env production --dry-run` shows `GAME_ROOM` + `ASSETS` bindings.
- **Gate (2026-05-31):** production smoke passed — create room, phone join, one timed human turn on live deploy.
