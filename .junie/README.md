# `.junie/` — bridge to `.cursor/`

This directory contains **only the loader bridge** for Junie. Rules, skills, and ignore patterns are canonical in `.cursor/`.

## Files

- **`guidelines.md`** — Junie reads this automatically. It points at `.cursor/rules/*.mdc`, `.cursor/skills/*/SKILL.md`, and `.cursorignore`.

## Why this layout

Single source of truth — no drift between Cursor and Junie. When you add a rule or skill, edit `.cursor/` once and update `guidelines.md` in the same change.

## Maintenance rule

New rule under `.cursor/rules/`, new skill under `.cursor/skills/`, or new `.cursorignore` pattern → **update `guidelines.md` in the same change**.
