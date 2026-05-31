---
description: Execute the Opus-attributed portion of a `[hybrid]`-tagged phase. Use when the user says `/implement-opus phase-<X.Y>` or `/implement-opus redesign phase-<N>`. Refuses non-`[hybrid]` phases — those should use `/implement` instead.
---

# Opus pass on a hybrid phase

The user invoked `/implement-opus <args>`. Two invocation shapes are supported:

- **Wave track (default):** `/implement-opus phase-<X>.<Y>`
- **Redesign track:** `/implement-opus redesign phase-<N>`

## Resolve the path

- Wave track: `phase-<X>.<Y>` → `.implementation/wave-<X>/phase-<X>.<Y>.md`
- Redesign track: `redesign phase-<N>` → `.implementation/redesign/phase-<N>.md`

Read **only that file**. Do not read other phase files.

## Pre-flight checks (in order, stop on the first failure)

1. **Hybrid required.** If the phase is **not** tagged `[hybrid]`, refuse and point to `/implement`.

2. **Model match.** Confirm **Opus 4.7**. If not, recommend switching and wait.

## Identify Opus-attributed work

3. The phase file splits work (e.g. **Opus:** game rules engine, move validation. **Composer:** board UI, animations). Implement **only** Opus-attributed bullets.

## Execute

4. Typical Opus work: pure game logic, schemas, algorithms, security boundaries, anything easy to get wrong if guessed.

5. **Status icon discipline** (per `execution.mdc`): `[~]` when Composer wiring or deploy is needed; `[x]` with artifact when verifiable in isolation.

6. **Append "Opus pre-work landed"** documenting files added/modified, verification artifact (test/lint output), and why items remain `[~]`.

7. Phase header ⬜ → 🟡 only (not ✅).

8. **Mirror 🟡 into `roadmap.mdc`** _(wave track only)_.

9. Do not modify other phase files.

10. **Rule-file conflicts** → update rules in same change; ⚠️ in `decisions.mdc` if unresolved.

## After implementation

11. Run verify scripts from `package.json` (scoped tests if localized).

12. Summarize Opus bullets, pending Composer work, verification, phase + roadmap status (🟡).

## What this skill explicitly does NOT do

- Touch Composer-attributed bullets.
- Flip phase header to ✅.
- Auto-switch the model.
