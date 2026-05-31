---
description: Distill the recent conversation into a reusable skill at `.cursor/skills/<name>/SKILL.md`. Use when the user says `/generate-skill` (optionally with a name argument) after working through something repeatable. Refuses if the conversation has no reusable pattern.
---

# Generate a new skill from this conversation

The user invoked `/generate-skill` (optionally with a name argument).

## Step 1 — Survey existing skills

List `.cursor/skills/*/` and read the **"Available slash commands"** section of `AGENTS.md`. If the proposed name collides with an existing skill, surface the collision and ask before overwriting.

## Step 2 — Choose a name

- If the user passed an argument, use it (directory `.cursor/skills/<name>/`).
- If no argument, propose one and **ask the user to confirm** before writing. Use `kebab-case`, verb-led where reasonable.

## Step 3 — Survey the rule files

Briefly read `core.mdc`, `execution.mdc`, `product.mdc`, `roadmap.mdc`, `decisions.mdc`, and any glob-scoped rules listed in `plan-map.mdc`. **Note what's already encoded** so the skill references them instead of duplicating.

## Step 4 — Distill the conversation

Extract the final working approach and earned pitfalls. Skip dead ends and content already in rule files.

If no reusable pattern, refuse with a clear reason. Stop.

## Step 5 — Replace specific values with placeholders

Use `<entity-name>`, `<module-path>`, etc. Keep stable project artifacts (rule file names, verify script names from `package.json`) literal.

## Step 6 — Compose the SKILL.md

Frontmatter `description:` must include when it triggers and what artifact it produces. Body: pre-flight checks, numbered steps, optional "does NOT do" section. Match voice of sibling skills.

## Step 7 — Confirm before writing

If unsure about naming, scope, or placeholders, ask. Otherwise write `.cursor/skills/<name>/SKILL.md`.

## Step 8 — Update AGENTS.md

Add one bullet under **"Available slash commands"**.

## Step 9 — Summarize

Report what was created and what was omitted.

## What this skill explicitly does NOT do

- Generate from nothing.
- Overwrite silently.
- Duplicate rule-file prose.
