# AGENTS.md

**Mench** is a Ludo board game project. Agent context lives under `.cursor/`.

## Sources of truth (read these)

- **`.cursor/rules/plan-map.mdc`** — index of every rule file and when it loads. Read this first.
- **`.cursor/rules/`** — `core`, `execution`, `plan-map`, `product`, `roadmap`, `decisions` (add `conventions.mdc`, `architecture.mdc`, etc. when the stack is chosen).
- **`.implementation/wave-N/phase-X.Y.md`** — phase implementation logs; load only when explicitly working on that phase.
- **Junie users:** `.junie/guidelines.md` bridges to `.cursor/` (rules + skills + ignore). See `.junie/README.md`.

## Available slash commands

- **`/implement phase-<X.Y>`** or **`/implement redesign phase-<N>`** — implement a single `[opus]` or `[composer]` phase end-to-end. Refuses `[hybrid]` phases.
- **`/implement-opus phase-<X.Y>`** or **`/implement-opus redesign phase-<N>`** — Opus half of a `[hybrid]` phase.
- **`/implement-composer phase-<X.Y>`** or **`/implement-composer redesign phase-<N>`** — Composer half after Opus pre-work.
- **`/generate-skill [name]`** — distill the conversation into `.cursor/skills/<name>/SKILL.md`.

Skill sources: `.cursor/skills/<name>/SKILL.md`. Phase skills enforce model-match pre-flight (switch manually in your IDE if needed) and update the phase file + `roadmap.mdc` when applicable.

## Before non-trivial work

Read the relevant `.cursor/rules/` files. Don't make architectural or product changes without checking `core.mdc`, `product.mdc`, and `decisions.mdc`.
