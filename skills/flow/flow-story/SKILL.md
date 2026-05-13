---
name: flow-story
description: 'CREATE phase of a story: exhaustive context engine (epic, architecture, project-context, git log, neighbor stories).
  Produces a story file so rich another LLM dev can implement without asking questions. Updates sprint-status.yaml backlog
  -> ready-for-dev. Use to prepare a story before /flow-dev.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-story — context engine (CREATE only)

You are a peer developer in preparation mode. You don't code. You gather all the context needed so that another LLM (or you in `/flow-dev` mode) can implement without ambiguity.

## When to use

- `backlog` story to prepare before implementation
- Re-preparation of a story whose context has changed
- First phase of the `flow-story → flow-dev → flow-review → flow-commit` cycle

## Inputs (required)

- `.agents/implementation/sprint-status.yaml` (find the story by id)
- The parent epic in `.agents/planning/epics/`
- `.agents/planning/architecture.md`
- `.agents/project-context.md`
- `git log -20` (recent patterns, implicit conventions)
- Neighbor stories in `.agents/implementation/stories/` (learnings)

## Process

### Step 1 — Discover target story
- Find the story `<id>` in sprint-status
- If not found, stop with a list of available stories
- If already `ready-for-dev`: in interactive mode, ask whether to redo or skip; **in batch mode (`$FLOW_AUTO=1`), skip silently and exit 0**

### Step 2 — Exhaustive context gathering
**Skip no source**:
- The parent epic (full read)
- Architecture (relevant sections)
- Project-context (conventions, patterns)
- Neighbor stories (same components, lessons learned)
- Git log: recent commits on the planned files
- Existing tests of the touched components

### Step 3 — Architecture compliance
For each touched component:
- What pattern does the repo already use?
- Which files UPDATE / CREATE / DELETE?
- Which existing tests must not break?

### Step 4 — Web research (if relevant)
If the story touches an external lib or third-party API, check current docs (versions, recent breaking changes).

### Step 5 — Produce the story file

`.agents/implementation/stories/story-<id>.md`:

```markdown
---
storyId: story-001-01
epic: epic-001
status: ready-for-dev
size: M
created: <date>
---

# story-001-01 — <title>

## User story description
As a ..., I want ..., so that ...

## Acceptance criteria
- [ ] Given ..., when ..., then ...

## Context
<exhaustive summary extracted from epic, architecture, project-context>

## Files to touch
- CREATE: <path> — <reason>
- UPDATE: <path> — <reason>
- DELETE: <path> — <reason>

## Implementation plan (5-10 steps)
1. ...

## Tests to write / pass
- Unit: ...
- Integration: ...
- E2E: ...

## Dev notes (guardrails)
- Conventions to respect: <project-context refs>
- Known traps: <repo patterns that could surprise>
- Out of scope: <what we do NOT touch>

## Change log
- <date>: story created
```

### Step 6 — Update sprint-status
- `backlog` → `ready-for-dev`
- No change to `currentStory` (reserved for `/flow-dev`)

## Output

- `.agents/implementation/stories/story-<id>.md` created
- `sprint-status.yaml` updated

## Next

- `/flow-dev <id>` to implement (reads the story file produced here)
- If context still fuzzy, redo `/flow-story <id>` after gathering more info

## Batch mode (`$FLOW_AUTO=1`)

When this env var is set (orchestration by `flow-auto/run.sh`):
- No user question. No menu.
- If the story is already `ready-for-dev`, exit 0 silently without doing anything.
- Otherwise, generate the story file and update sprint-status, then exit 0.
- Any halt condition (story not found, dependency not satisfied) → clear error message + exit non-zero to fail the phase on the run.sh side.
