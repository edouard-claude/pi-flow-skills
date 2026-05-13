---
name: flow-retro
description: End-of-epic retrospective in party mode (multi-role dialogues), with critical readiness exploration and preparation
  for the next epic. Captures lessons, updates project-context.md, generates action items. Use when all stories of an epic
  are done.
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-retro — retrospective + next-epic prep

You facilitate in **party mode**: all exchanges in `Name (Role): dialogue` format. The user is an active participant, not a spectator. Psychological safety is sacred — focus on systems, not blame.

## When to use

- All stories of an epic are `done` in sprint-status
- User says 'retro', 'epic wrap-up'
- At the transition between two epics

## Inputs (deep dive required)

- `.agents/implementation/sprint-status.yaml`
- `.agents/planning/epics/<epic-completed>.md`
- `.agents/implementation/stories/story-<epic>-*.md` (all epic stories, **read Dev Notes**)
- `.agents/implementation/retro-epic-<previous>.md` if present (continuity)
- `.agents/planning/prd.md` + `.agents/planning/architecture.md`
- `git log` since the epic started

## Process — 12 steps with party mode

### Step 1 — Epic discovery
- Identify the completed epic via sprint-status
- Confirm with the user: "Retro on epic-NNN <title>?"

### Step 2 — Deep story analysis
For each story of the epic:
- Dev notes (challenges, decisions)
- Review feedback (`[AI-Review]` items resolved)
- Recurring patterns
- Identified tech debt
- Tests: coverage, gaps

### Step 3 — Previous retro follow-through
If a previous retro exists:
- Which action items were followed up on?
- Which stayed open?
- Why?

### Step 4 — Next epic preview
If a next epic is defined:
- Dependencies with the closing epic
- Identified gaps (missing architecture, missing refs)
- Prerequisites to put in place

### Step 5 — Initialize retro
Init `.agents/implementation/retro-epic-<NNN>-<date>.md` with loaded context.

### Step 6 — Epic review discussion (party mode)

Facilitate three sections, **dialogues in `Name (Role): dialogue` format**:

#### What Went Well
```
Alex (Tech Lead): We delivered all 8 stories without scope creep. The auth pattern from the previous epic paid off.
You (PO): Right, and the mid-epic checkpoint decision saved us from redoing X.
```

#### Challenges
```
Sam (Developer): Story-003 underestimated multi-tenancy complexity. Took 3 days instead of 1.
Alex (Tech Lead): True. Our architecture under-specified the RLS policies.
```

#### Patterns
```
Sam (Developer): I saw the same logic replicated across 3 stories. Refactor candidate.
You (PO): Tag it for the next epic?
```

The user intervenes freely, can take any role or speak in their own name.

### Step 7 — Next epic preparation (interactive)
Open discussion, debate allowed:
- Is the next epic well framed?
- Anticipated risks?
- What do we carry over (patterns, debt to pay)?

### Step 8 — Synthesize action items
Categorize:
- **Process** (method change for next epic)
- **Tech debt** (to pay in next epic or tag)
- **Documentation** (project-context to enrich)
- **Skills** (learnings to formalize)

### Step 9 — Critical readiness exploration
Before moving to the next epic, check 5 dimensions:
- **Testing**: sufficient coverage? E2E tests in place?
- **Deployment**: prod-ready? Rollback plan?
- **Stakeholder acceptance**: end user / client validation?
- **Tech health**: monitoring, alerts, perf metrics OK?
- **Blockers**: external dependencies resolved?

If a point is not green, suggest a stabilization story before the next epic.

### Step 10 — Closure
Short but sincere celebration. Acknowledge wins.

### Step 11 — Save + update artifacts
- `.agents/implementation/retro-epic-<NNN>-<date>.md` finalized
- **Update `.agents/project-context.md`** if emerging patterns (conventions to lock in for subsequent agents)
- Update sprint-status: tag the epic as `retrospected`

### Step 12 — Final summary + handoff
5-line summary:
- 2-3 wins
- 2-3 challenges + actions
- Recommendation for what's next

## Output

- `.agents/implementation/retro-epic-<NNN>-<date>.md`
- `.agents/project-context.md` updated if patterns identified
- `sprint-status.yaml` tagged

## Next

- Next epic ready → `/flow-sprint` then `/flow-story <next-id>`
- Critical readiness red on a dimension → `/flow-story` stabilization first
- All epics done → project delivered, or `/flow-brief` for v2
- Major change revealed during the retro → `/flow-course-correct`
