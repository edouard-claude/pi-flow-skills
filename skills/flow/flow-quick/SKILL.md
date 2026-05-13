---
name: flow-quick
description: 'Bypass of the full flow pipeline: user intent -> delivered code -> review, in one loop. For fixes, small features,
  adjustments (single user-facing goal). Use for any task under one day of dev, or when the user says ''quick fix'', ''small
  change''.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-quick — intent to code in a short loop

Sweet spot: task scopable in 900-1600 tokens of intent, single user-facing goal. No PRD, no architecture, no story file — just clean code + commit.

## When to use

- Circumscribed bug fix (1 identifiable root cause)
- Small feature (< 1 dev day)
- Local refactor (1-2 files)
- Config / env adjustment
- Wiring up an existing endpoint

**NOT for**: new major feature, refactor, new external integration, structural scope change → use the pipeline (`flow-prd` or `flow-story`).

## Process — step-by-step

### Step 1 — Clarify & route (scope gate)

1. **Read** `.agents/project-context.md` if present (conventions to respect)
2. **Evaluate** the intent: single goal? if not, redirect
3. **Ask 2-3 questions max** if ambiguous:
   - Precise expected behavior?
   - Edge cases that matter?
   - Components to touch or leave untouched?
4. **Scope check**: if the conversation reveals a scope > 1 day or multi-feature, **STOP** and suggest `/flow-prd` or `/flow-story`.

### Step 2 — Plan (5 lines max)

Quick plan in 5 lines:
- Root cause (if fix)
- Files to touch
- Approach (1 sentence)
- Tests to add/modify
- Risks (1 sentence)

Present, wait for quick OK or adjustment.

### Step 3 — Implement

- Strictly follow the repo conventions (project-context)
- No opportunistic refactor outside scope
- Keep the diff minimal
- Run existing tests after changes

### Step 4 — Self-review

- Bugs / edge cases covered?
- Conventions respected?
- No TODO / commented-out code left?
- Tests pass?

### Step 5 — Commit draft

Propose a **conventional commits** message:
```
type(scope): short description

[optional body: reason for the change, not the what]
```

## Output

No file in `.agents/`. Just:
- The modified code
- The tests
- A commit message draft

## Halt conditions

If mid-way:
- You discover a deeper bug → stop, suggest `/flow-story` or `/flow-introspect`
- The intent changes → stop, ask for clarification
- Existing tests break and it's non-trivial → stop, escalate

## Next

None. If the task turns out to be bigger mid-run, stop and suggest `/flow-prd` (if new feature) or `/flow-story` (if inside a sprint).
