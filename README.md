# Mench (منچ)

Web-first standard Ludo for 2–4 players (local and online). This repo is the Mench v1 monorepo: React client, pure rules engine, and Cloudflare Worker (later waves).

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+

## Install

```bash
pnpm install
```

## Development

**Client only** (UI + local game):

```bash
pnpm dev
```

Opens the Vite dev server at `http://localhost:5173` (port may vary).

**Online API locally** (Cloudflare Worker + Durable Objects):

```bash
pnpm dev:worker
```

Runs [`wrangler dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev) on **http://127.0.0.1:8787**. First time on a machine:

```bash
npx wrangler login
```

With **both** running, Vite proxies `/api/*` (including **WebSockets**) to the Worker so the browser can call `fetch('/api/rooms')` and open `ws://localhost:5173/api/rooms/…/ws` without CORS friction. If you change `vite.config.ts` proxy settings, restart `pnpm dev`.

## Cloudflare layout (Pages vs Worker vs Durable Object)

| Piece | What it is | Mench role |
| ----- | ---------- | ---------- |
| **Pages** | Static hosting for the built SPA (`dist/`) | Serves the React app in production |
| **Worker** | Stateless HTTP at the edge (`worker/index.ts`) | Routes `/api/health`, `POST /api/rooms`, later WebSocket upgrade |
| **Durable Object (`GameRoom`)** | One long-lived object **per room ID** | Holds that room’s connections and authoritative game state (see `worker/room.ts`) |

Workers alone cannot remember which tab belongs to which half-finished game. A **Durable Object** is Cloudflare’s “single coordinator per room” primitive: all players in room `abc` talk to the same `GameRoom` instance. The free tier is enough for friends-and-family traffic; bindings live in `wrangler.toml`.

## Scripts

| Script | Description |
| ------ | ----------- |
| `pnpm dev` | Start Vite dev server |
| `pnpm dev:worker` | Start local Worker + DO via Wrangler (`:8787`) |
| `pnpm build` | Typecheck and production build to `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm check:types` | `tsc --noEmit` (app + worker project references) |
| `pnpm check:lint` | ESLint |
| `pnpm check:pwa` | Manifest + service worker checks (needs `pnpm preview` running) |
| `pnpm test` | Vitest (unit tests) |
| `pnpm deploy` | Production build + `wrangler deploy --env production` |

## Production deploy (Cloudflare)

One **Worker** serves the built SPA (`dist/`) and `/api/*` on the same origin so WebSockets and `fetch('/api/…')` work without extra CORS setup. **Durable Objects** use the same bindings as local dev (`wrangler.toml`).

### Account setup (first time)

1. Create a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is enough).
2. Log in Wrangler on your machine:

   ```bash
   pnpm exec wrangler login
   ```

3. Confirm the account:

   ```bash
   pnpm exec wrangler whoami
   ```

No secrets are required for v1. Optional: add a custom domain in the dashboard later and uncomment `routes` under `[env.production]` in `wrangler.toml`.

### Deploy

```bash
pnpm deploy
```

This runs `pnpm build` then `wrangler deploy --env production`. Wrangler prints the live URL (default `https://mench.<your-subdomain>.workers.dev` unless you configure a route).

Compile-only check (no upload):

```bash
pnpm build
pnpm exec wrangler deploy --env production --dry-run
```

### Production smoke checklist

Run these against the deployed URL (desktop + phone on cellular/Wi‑Fi):

1. **Health** — `curl -s https://<your-host>/api/health` returns `{"ok":true,...}`.
2. **Create room** — open the app → Online → host a room; note join code / share link.
3. **Join from phone** — open the share link on a second device; both reach lobby or board.
4. **One timed turn** — start the game; human seat rolls and moves once; 30s timer visible and server accepts the intent.

Custom domain is optional (see `wrangler.toml` `[env.production]` comments).

### API smoke test (local Worker)

```bash
pnpm dev:worker
# another terminal:
curl -s http://127.0.0.1:8787/api/health
curl -s -X POST http://127.0.0.1:8787/api/rooms -H "Content-Type: application/json"
```

`POST /api/rooms` returns `{ roomId, joinCode, wsUrl }` (WebSocket path is reserved for phase 4.2).

## Layout

```
src/
  game/       # pure rules engine (no React)
  features/   # lobby, board, session UI
  shared/     # UI primitives, styles, hooks
worker/       # Cloudflare Worker + Durable Objects (wave 4)
```

See `.cursor/rules/` and `AGENTS.md` for agent and architecture context.
