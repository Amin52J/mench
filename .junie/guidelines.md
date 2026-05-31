# Junie guidelines — Mench

Canonical agent context lives in `.cursor/`. This file is the bridge.

If Junie cannot natively follow Cursor's auto-attach (`alwaysApply`, `globs`, `description`), read the files below explicitly. Do not duplicate their contents in your reply.

---

## Always-on rule files

- **`.cursor/rules/core.mdc`** — mission, principles, what-not-to-do
- **`.cursor/rules/execution.mdc`** — discipline, two-strikes, verification
- **`.cursor/rules/plan-map.mdc`** — index of all rules

---

## Context-conditional rule files

| Rule file | When to read |
| --------- | ------------ |
| `.cursor/rules/product.mdc` | Game rules, UX, features |
| `.cursor/rules/roadmap.mdc` | Planning waves, scheduling, scope |
| `.cursor/rules/decisions.mdc` | "Why was X decided?" or revisiting choices |
| _(add rows when you create `conventions.mdc`, etc.)_ | |

---

## Slash commands

| Trigger | Source |
| ------- | ------ |
| `/implement phase-<X.Y>` | `.cursor/skills/implement/SKILL.md` |
| `/implement redesign phase-<N>` | `.cursor/skills/implement/SKILL.md` |
| `/implement-opus phase-<X.Y>` | `.cursor/skills/implement-opus/SKILL.md` |
| `/implement-composer phase-<X.Y>` | `.cursor/skills/implement-composer/SKILL.md` |
| `/generate-skill [name]` | `.cursor/skills/generate-skill/SKILL.md` |

`AGENTS.md` at the repo root lists the same triggers.

**Model pre-flight:** phase skills may require Opus vs Composer. If the active model doesn't match, recommend switching and wait for confirmation.

---

## Implementation log

Phase work lives under `.implementation/wave-<N>/phase-<X.Y>.md`. Read **only the file you're pointed at**.

---

## Ignore policy

Honor **`.cursorignore`** as the authoritative ignore list. Never read `.env*` (except `.env.example`), `node_modules/`, `dist/`, or lockfiles into context without asking.

---

## Rule conflicts

Per `execution.mdc`: quote conflicting rules with `file:line`, or state the deviation explicitly before proceeding.

---

## What this file is NOT

Not a duplicate of `.cursor/rules/`. Not exhaustive — new artifacts under `.cursor/` are authoritative; add a row here when you add them.
