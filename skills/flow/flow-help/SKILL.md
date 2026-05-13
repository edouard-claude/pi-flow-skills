---
name: flow-help
description: Entry point of the flow workflow. Displays a complete sprint dashboard (all epics, all stories, statuses) then
  recommends the next step among flow-brainstorm, flow-brief, flow-introspect, flow-prd, flow-architecture, flow-epics, flow-sprint,
  flow-story, flow-dev, flow-review, flow-commit, flow-quick, flow-course-correct, flow-retro, flow-auto. Use to take stock,
  find out where you stand, or at the start of a session.
version: 0.1.2
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-help — dashboard + orientation

You are a peer facilitator, not a menu. First show the sprint overview, then reason about dependencies and propose ONE single next step.

## When to use

- Start of a session on a flow-driven project
- User lost: 'where are we?', 'what do I do next?'
- After each flow skill, to decide what comes next
- Anytime to get the sprint state

## Inputs

- `.agents/implementation/sprint-status.yaml` (if present)
- `.agents/planning/epics/*.md` (titles, structure)
- `.agents/` (whole tree to detect the phase)
- `git log -10` (recent activity)

## Process

### Step 1 — Sprint dashboard (ALWAYS first, if sprint-status.yaml exists)

Read `.agents/implementation/sprint-status.yaml`. Display ALL stories grouped by epic in numeric order, with their status. **Strict format**:

```
Epic N (<epic-status>)
  <symbol> <id-slug>                 <status>
  <symbol> <id-slug>                 <status>
  ...
```

**Status symbols**:
- `✓` done
- `▶` in-progress / review (running)
- `◆` ready-for-dev (ready to pick up)
- `○` backlog (not started)
- `✗` blocked / cancelled

**Aggregated epic status** (in parentheses after "Epic N"):
- `done` — all stories of the epic are done
- `in-progress` — at least one story is in-progress, review, or ready-for-dev
- `backlog` — no story started yet, but some are done
- `not-started` — all stories are backlog

**Alignment**: constant padding on story ids so status columns align. Compute max id-slug width + 2 spaces.

**If no sprint-status.yaml**: skip this step, just state the current phase.

### Step 2 — Phase detection

Determine the phase from the artifacts present:
- No `.agents/` + existing code → brownfield, recommend `/flow-introspect`
- No `.agents/` + empty repo → greenfield, recommend `/flow-brainstorm` or `/flow-brief`
- `product-brief.md` present, no `prd.md` → `/flow-prd`
- `prd.md` present, no `architecture.md` → `/flow-architecture`
- `architecture.md` present, no `epics/` → `/flow-epics`
- `epics/` present, no `sprint-status.yaml` → `/flow-sprint`
- `sprint-status.yaml` with `ready-for-dev`/`backlog` stories → `/flow-story <id>` or `/flow-auto`
- Story `in-progress` → `/flow-dev <id>`
- Story `review` → `/flow-review <id>`
- All stories of an epic `done` but no retro yet → `/flow-retro`
- Major change signaled → `/flow-course-correct`

### Step 3 — Gates and prioritization

- Never recommend a phase without its prerequisite (no `flow-architecture` without PRD, no `flow-story` without sprint-status).
- Prefer `/flow-auto` when several stories are ready in backlog/ready-for-dev (batch mode).
- If a story is in progress, recommend finishing its cycle before starting a new one.

## Output

Two-block output format:

### Block 1 — Dashboard (if sprint in progress)

```
Sprint: <name> | Stories: <total> | Done: <n> | In progress: <n> | Backlog: <n>

Epic 1 (done)
  ✓ 1-1-init-driver-profile   done
  ✓ 1-2-driver-vehicle        done

Epic 2 (in-progress)
  ✓ 2-1-signup-phone          done
  ▶ 2-2-signup-phone-verify   in-progress
  ◆ 2-3-complete-signup       ready-for-dev
  ○ 2-4-login-email           backlog

Epic 3 (not-started)
  ○ 3-1-...                   backlog
```

### Block 2 — Recommendation (always, 4 lines max)

```
State : <current phase + summary>
Reco  : /flow-<name> [args]
Why   : <1 sentence>
Output: <expected artifact>
```

**Do not launch the next skill.** Propose, the user invokes.

## Implementation notes

- Read `sprint-status.yaml` directly via Read (single YAML file).
- To group by epic, parse `story.epic` and sort numerically (epic-001, epic-002…).
- For the slug, use the full id (`1-1-init-driver-profile` rather than `story-001-01`) — consistent with what the user sees in file names.
- If the list is very long (> 50 stories), don't display 100%-done epics in detail — show "Epic N (done — 8 stories)" compactly.

## `.agents/` reference layout

```
.agents/
├── planning/
│   ├── brainstorm-<theme>.md
│   ├── product-brief.md
│   ├── current-state.md
│   ├── prd.md
│   ├── architecture.md
│   └── epics/
│       └── epic-XXX.md
├── implementation/
│   ├── sprint-status.yaml
│   ├── stories/
│   │   └── story-XXX.md
│   └── retro-epic-XXX.md
└── project-context.md
```
