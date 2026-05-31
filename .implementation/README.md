# Implementation log

Phased work lives here as markdown files, one phase per file.

## Layout

```
.implementation/
  wave-1/   # scaffold + rules engine
  wave-2/   # local UI + animations
  wave-3/   # CPU opponents
  wave-4/   # Cloudflare online play
  wave-5/   # PWA + production deploy
  redesign/ # optional cross-cutting track
```

**Start here:** `/implement phase-1.1`

## Phase file shape (minimal)

```markdown
### Phase 1.1 — Board render ⬜ `[composer]`

**Gate:** `pnpm test` passes; board visible in dev server.

- [ ] ...
```

Tags: `[opus]`, `[composer]`, or `[hybrid]` (split across `/implement-opus` and `/implement-composer`).

Status icons: ⬜ not started · 🟡 in progress · ✅ done

Checkboxes: `[ ]` · `[~]` unverified · `[x]` verified (with artifact)

Mirror phase icons into `roadmap.mdc` when using wave track.

## Slash commands

See `AGENTS.md` — `/implement`, `/implement-opus`, `/implement-composer`.
