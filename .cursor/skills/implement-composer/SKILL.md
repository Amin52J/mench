---
description: Execute the Composer-attributed portion of a `[hybrid]`-tagged phase, picking up after Opus pre-work. Use when the user says `/implement-composer phase-<X.Y>` or `/implement-composer redesign phase-<N>`. Refuses non-`[hybrid]` phases.
---

# Composer pass on a hybrid phase

The user invoked `/implement-composer <args>`. Wave and redesign tracks match `/implement-opus` path resolution.

## Pre-flight checks (in order, stop on the first failure)

1. **Hybrid required.** If not `[hybrid]`, refuse and point to `/implement`.

2. **Model match.** Confirm **Composer 2**. If not, recommend switching and wait.

3. **Opus pre-work check.** If there is no "Opus pre-work landed" (or equivalent) and Opus bullets aren't `[x]`/`[~]`, refuse and point to `/implement-opus` first.

## Execute

4. Implement **only** Composer-attributed bullets. Trust Opus libraries/schemas already in the tree.

5. **Status icon discipline** (per `execution.mdc`).

6. Phase header 🟡 → ✅ only when all items `[x]` and Gate passes (or manually verified with date).

7. **Mirror status into `roadmap.mdc`** _(wave track only)_.

8–10. Deviation notes; no other phase files; rule conflicts → update rules + `decisions.mdc`.

## After implementation

11. Run verify scripts from `package.json`.

12. Summarize Composer work, closed Opus `[~]` items, gate result, status transitions.

## What this skill explicitly does NOT do

- Re-do Opus pre-work silently.
- Flip ✅ without verification.
- Auto-switch the model.
