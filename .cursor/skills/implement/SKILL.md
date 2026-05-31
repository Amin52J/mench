---
description: Implement an entire `[opus]` or `[composer]`-tagged phase end-to-end. Refuses `[hybrid]` phases — those need `/implement-opus` and `/implement-composer` instead. Use when the user says `/implement phase-<X.Y>` (e.g. `/implement phase-1.1`) or `/implement redesign phase-<N>` (e.g. `/implement redesign phase-1`).
---

# Implement a single (non-hybrid) phase

The user invoked `/implement <args>`. Two invocation shapes are supported:

- **Wave track (default):** `/implement phase-<X>.<Y>` — e.g. `/implement phase-1.1`.
- **Redesign track:** `/implement redesign phase-<N>` — e.g. `/implement redesign phase-1`. The literal token `redesign` selects a cross-cutting plan in `.implementation/redesign/`.

## Resolve the path

- Wave track: `phase-<X>.<Y>` → `.implementation/wave-<X>/phase-<X>.<Y>.md`. Example: `phase-1.1` → `.implementation/wave-1/phase-1.1.md`.
- Redesign track: `redesign phase-<N>` → `.implementation/redesign/phase-<N>.md`.

Read **only that file** for the phase plan. Do not read other phase files (in particular, do not read `.implementation/redesign/README.md` unless the phase file points at it for a specific decision).

## Pre-flight checks (in order, stop on the first failure)

1. **Hybrid refusal.** Read the phase header. If it is tagged `[hybrid]`, refuse:

   > _"This phase is `[hybrid]` — its work is split between Opus (design) and Composer (execution). `/implement` only handles single-model phases. Use `/implement-opus phase-<X.Y>` for the Opus pass and `/implement-composer phase-<X.Y>` for the Composer pass."_
   > Stop. Do not proceed.

2. **Model match.** The phase tag tells you which model to be on:
   - `[opus]` → Opus 4.7
   - `[composer]` → Composer 2

   If the active model does not match the tag, say in plain text:

   > _"I'd recommend switching to <Opus / Composer 2> for this — the phase is tagged `[<opus / composer>]`."_
   > Wait. Do not proceed until the model is correct (per `execution.mdc` "When stuck — Escalation").

## Execute the phase

3. Implement every unchecked item in the phase's checklist, in order, top-to-bottom unless an item explicitly notes a parallel fork.

4. **Status icon discipline** (per `execution.mdc`):
   - `[ ]` — not started.
   - `[~]` — completed-but-unverified (gate command not run, or structurally-unverifiable gate pending).
   - `[x]` — only with a verification artifact: CI URL, command exit-0 output, screenshot, or "manually inspected on `<date>`".

5. **Append deviation notes** to the phase file's "Key decisions earned here" or "Notes" section. If neither exists, add a "Notes" section.

6. **Phase header status icon** flips ⬜ → 🟡 when you start, and 🟡 → ✅ only when every checklist item is `[x]` and the phase's "Gate" line is met. If the gate cannot run on this machine, leave at 🟡 with a one-liner.

7. **Mirror the status into `roadmap.mdc`** _(wave track only)_. Update the phase line's icon; if the wave is fully complete, update the wave-level status. Do **not** otherwise rewrite `roadmap.mdc`. **Redesign track:** skip `roadmap.mdc`; update the phase file header and any redesign README status table.

8. **Do not modify other phase files.**

9. **Rule-file conflicts.** If a rule file (`core.mdc`, `product.mdc`, `roadmap.mdc`, `decisions.mdc`, or any glob-scoped rules from `plan-map.mdc`) is wrong or incomplete, update it **in the same change**. New conflicts → ⚠️ row in `decisions.mdc` until resolved.

## After implementation

10. Run the project's verify scripts from `package.json` (lint, type-check, tests). Address failures before declaring done.

11. Summarize: checkboxes flipped, phase + roadmap status, rule-file edits, gate verification result.

## What this skill explicitly does NOT do

- Read or modify other phase files.
- Auto-switch the model.
- Bypass the two-strikes rule from `execution.mdc`.
