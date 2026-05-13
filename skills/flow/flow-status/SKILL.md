---
name: flow-status
description: Pure sprint dashboard. Lists every epic and story with its status (using symbols), grouped by epic, in YAML order. No
  next-step recommendation (use /flow-help for that). Cheap and focused. Use when the user says 'show sprint status', 'where
  are we', 'progress', or just wants the dashboard without orientation.
version: 0.2.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-status — sprint dashboard

Pure status output. No reasoning, no recommendation. Just renders what `sprint-status.yaml` says.

## When to use

- User wants a quick visual of the sprint progress
- Need to surface what is done / in-progress / blocked
- After any `flow-*` skill, to confirm a state transition landed
- Cheap alternative to `/flow-help` when orientation isn't needed

## Inputs

- `.agents/implementation/sprint-status.yaml` (required — error out if missing)

## Process

1. **Read** `.agents/implementation/sprint-status.yaml`.
2. **Parse** the `development_status` block (BMAD-style flat map of `key: status`).
3. **Group** entries by epic in declaration order. Recognize keys:
   - `epic-NNN` → epic header
   - `story-NNN-MM` → story line
   - `epic-NNN-retrospective` → retrospective marker (after the epic block)
4. **Render** with one symbol per story status:

| Symbol | Status |
|---|---|
| `✓` | done |
| `▶` | in-progress / review |
| `◆` | ready-for-dev |
| `○` | backlog |
| `✗` | blocked / cancelled |

5. **Aggregate epic status** (shown in parentheses after `Epic N`):
   - `done` — all stories of the epic are `done`
   - `in-progress` — at least one story is `in-progress`, `review`, or `ready-for-dev`
   - `backlog` — no story started, but the epic key in `development_status` says backlog
   - `not-started` — all stories `backlog`

6. **Sprint summary** at the top (one line):
   `Sprint: <name> | Stories: <total> | Done: <n> | In progress: <n> | Backlog: <n>`

## Output format (strict)

```
Sprint: <name> | Stories: <total> | Done: <n> | In progress: <n> | Backlog: <n>

Epic 1 (done)
  ✓ story-001-01   done
  ✓ story-001-02   done

Epic 2 (in-progress)
  ✓ story-002-01   done
  ▶ story-002-03   in-progress
  ○ story-002-04   backlog
  ...

Epic 3 (not-started)
  ○ story-003-01   backlog
  ...
```

**Alignment**: pad story ids to the longest id width + 2 spaces so status columns align.

**Compact mode for very long sprints** (> 50 stories): collapse fully-done epics into a one-liner `Epic N (done — 8 stories)` instead of listing each story.

## What this skill does NOT do

- No recommendation. No "next command". No reasoning. → use `/flow-help`.
- No risk surfacing. No retrospective hints. → use `/flow-retro` at end of epic.
- No artifact creation. Pure read-only.

## Output is text

Don't write to any file. Pure stdout for the user.
