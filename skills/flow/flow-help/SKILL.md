---
name: flow-help
description: Orientation skill. Detects the current flow phase from .agents/ artifacts and recommends ONE next command among
  flow-brainstorm, flow-brief, flow-introspect, flow-prd, flow-architecture, flow-epics, flow-sprint, flow-status, flow-story,
  flow-dev, flow-review, flow-commit, flow-quick, flow-course-correct, flow-retro, flow-auto. Lightweight — does not render the
  sprint dashboard (use /flow-status for that). Use when the user asks 'what do I do next', 'where are we in the process', or at
  the start of a session.
version: 0.5.0
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

### Step 0 — Cold-start detection (cheap, always done)

If `.agents/memory/overview.md` exists, the project has long-term memory. Check whether the user is **returning after a long gap**:

```bash
last_commit_age_days=$(( ( $(date +%s) - $(git log -1 --format=%ct 2>/dev/null || date +%s) ) / 86400 ))
```

- `last_commit_age_days >= 30` → **cold-start mode**: prefix your output with a Welcome-back block (see Output section). Read:
  - The latest `## État actuel — <date>` block of `.agents/memory/overview.md` (the last one — earlier ones are archived as `## État au <date>`)
  - The last 3-5 entries of `.agents/memory/journal.md` (tail)
- `last_commit_age_days < 30` → **warm-start**: skip the Welcome-back block, but you may still cite memory if the user explicitly asks "what did we decide about X".

If `.agents/memory/` does not exist, skip Step 0 entirely (project has no memory layer yet — `flow-retro` populates it).

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

### Warm-start (default)

4 lines max:

```
State : <current phase + key artifact present>
Reco  : /flow-<name> [args]
Why   : <one sentence>
Output: <expected artifact>
```

### Cold-start (gap ≥ 30 days, memory layer present)

Prefix the 4-line block with a Welcome-back panel:

```
Welcome back — last activity <N> days ago.

Project state (per .agents/memory/overview.md):
<paraphrase the latest État actuel block in 2-3 lines, no padding>

Recent epics:
- <date> — <epic-id>: <one-line from journal>
- <date> — <epic-id>: <one-line from journal>
- <date> — <epic-id>: <one-line from journal>

State : <current phase + key artifact present>
Reco  : /flow-<name> [args]
Why   : <one sentence>
Output: <expected artifact>
```

Cite verbatim from memory files — never invent. If `overview.md` exists but is empty (no État actuel block yet), say "Project state: memory layer present but no overview yet — run /flow-retro after the next epic."

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
├── memory/                  # long-term, populated by /flow-retro (v0.5+)
│   ├── overview.md
│   ├── decisions.md
│   ├── lessons.md
│   ├── journal.md
│   └── glossary.md
├── internal/                # transient sub-agent outputs (v0.4+)
│   └── <story-id-or-epic-id>/
└── project-context.md
```
