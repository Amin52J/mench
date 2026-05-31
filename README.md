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
| `pnpm test` | Vitest (unit tests) |

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
