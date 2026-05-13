---
name: flow-help
description: Orientation skill. Detects the current flow phase from .agents/ artifacts and recommends ONE next command among
  flow-brainstorm, flow-brief, flow-introspect, flow-prd, flow-architecture, flow-epics, flow-sprint, flow-status, flow-story,
  flow-dev, flow-review, flow-commit, flow-quick, flow-course-correct, flow-retro, flow-auto. Lightweight — does not render the
  sprint dashboard (use /flow-status for that). Use when the user asks 'what do I do next', 'where are we in the process', or at
  the start of a session.
version: 0.2.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-help — orientation

You are a peer facilitator, not a menu. Detect the phase, reason about gates and dependencies, propose ONE single next step with clear rationale.

For the visual sprint dashboard (epics + stories with status symbols), point the user to `/flow-status` — that is a separate, cheap skill. This skill stays light.

## When to use

- Start of a session on a flow-driven project
- User asks 'what do I do next', 'where are we in the process'
- After each flow skill, to decide what comes next

## Inputs

- `.agents/` (whole tree to detect the phase)
- `.agents/implementation/sprint-status.yaml` (if present, for current/next story)
- `git log -10` (recent activity)

## Process

### Step 1 — Phase detection

Determine the phase from the artifacts present:

| Present | Missing | Phase | Recommend |
|---|---|---|---|
| code | `.agents/` | brownfield | `/flow-introspect` |
| nothing | everything | greenfield | `/flow-brainstorm` or `/flow-brief` |
| `product-brief.md` | `prd.md` | planning | `/flow-prd` |
| `prd.md` | `architecture.md` | solutioning | `/flow-architecture` |
| `architecture.md` | `epics/` | solutioning | `/flow-epics` |
| `epics/` | `sprint-status.yaml` | implementation | `/flow-sprint` |
| sprint with `in-progress` story | — | implementation | `/flow-dev <id>` |
| sprint with `review` story (no Senior Review) | — | implementation | `/flow-review <id>` |
| sprint with `review` story + Senior Review | — | implementation | `/flow-commit <id>` |
| sprint with `ready-for-dev` / `backlog` stories | — | implementation | `/flow-story <id>` or `/flow-auto` |
| all stories of an epic `done`, retrospective `optional` | — | end of epic | `/flow-retro` |
| user signals a major change | — | anytime | `/flow-course-correct` |

### Step 2 — Gates and prioritization

- Never recommend a phase without its prerequisite (no `flow-architecture` without PRD, no `flow-story` without sprint-status).
- Prefer `/flow-auto` when several stories are eligible (batch mode).
- If a story is in progress, recommend finishing its cycle before starting a new one.

### Step 3 — Read sprint-status briefly

If `sprint-status.yaml` exists, scan `development_status` to find:
- Currently `in-progress` or `review` story (resume target)
- Next eligible story (the first `backlog` / `ready-for-dev` whose dependencies in `dependencies:` are all `done`)

## Output

4 lines max:

```
State : <current phase + key artifact present>
Reco  : /flow-<name> [args]
Why   : <one sentence>
Output: <expected artifact>
```

If the user wants the visual dashboard, append at the end:
```
For the full sprint dashboard, run /flow-status.
```

**Do not launch the next skill.** Propose, the user invokes.

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
│   ├── sprint-status.yaml   # development_status + dependencies (BMAD-style)
│   ├── stories/
│   │   └── story-XXX.md
│   └── retro-epic-XXX.md
└── project-context.md
```
