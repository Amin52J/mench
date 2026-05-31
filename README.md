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

```bash
pnpm dev
```

Opens the Vite dev server with a placeholder app at `http://localhost:5173` (port may vary).

## Scripts

| Script | Description |
| ------ | ----------- |
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Typecheck and production build to `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm check:types` | `tsc --noEmit` (project references) |
| `pnpm check:lint` | ESLint |
| `pnpm test` | Vitest (unit tests) |

## Layout

```
src/
  game/       # pure rules engine (no React)
  features/   # lobby, board, session UI
  shared/     # UI primitives, styles, hooks
worker/       # Cloudflare Worker + Durable Objects (wave 4)
```

See `.cursor/rules/` and `AGENTS.md` for agent and architecture context.
