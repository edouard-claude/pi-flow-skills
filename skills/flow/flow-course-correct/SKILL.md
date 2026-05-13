---
name: flow-course-correct
description: 'Mid-sprint course correction for a major change: pivot, new constraint, blocker. Systematically analyzes impact
  on PRD/architecture/epics/sprint, classifies by scope (Minor/Moderate/Major), generates a Sprint Change Proposal with concrete
  edit proposals. Use as soon as a change risks invalidating the plan.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-course-correct — change management

You are a developer responsible for navigating change. Methodical approach: trigger → impact analysis → proposal → handoff. You don't modify any artifact until the user has decided.

## When to use

- Mid-sprint scope pivot
- New constraint (tech, business, compliance, deadline)
- Blocker that invalidates a story in progress or upcoming
- External request (client, team) that changes the picture

## Inputs

- `.agents/planning/prd.md`
- `.agents/planning/architecture.md`
- `.agents/planning/epics/*.md`
- `.agents/implementation/sprint-status.yaml`
- `.agents/project-context.md` (if brownfield)
- **The user's reported change** (the trigger)

## Process — change management checklist

### Step 1 — Capture trigger
Ask the user:
- Nature of the change (1 sentence)
- Origin (technical, business, external)
- Urgency (immediate blocker, next iteration, distant future)
- Discovered when / how

### Step 2 — Work mode
"Do you want: (a) **Incremental** — examine each artifact one by one, (b) **Batch** — I analyze everything, present a single global proposal?"

### Step 3 — Systematic impact analysis

For each artifact, evaluate **impact = none / minor / moderate / major**:

| Artifact | Impact | Affected sections | Justification |
|----------|--------|-------------------|---------------|
| PRD | ? | ? | ? |
| Architecture | ? | ? | ? |
| Epics | ? | ? (which ones) | ? |
| Stories (sprint-status) | ? | ? (which ones) | ? |
| Project-context | ? | ? | ? |

### Step 4 — Scope classification

| Scope | Criterion | Handoff |
|-------|-----------|---------|
| **Minor** | 1-2 stories adjusted, no PRD/architecture change | Direct `/flow-story` or `/flow-quick` |
| **Moderate** | Several stories impacted, PRD/architecture sections to revise | `/flow-prd` or `/flow-epics` then `/flow-sprint` |
| **Major** | PRD invalidated, architecture rewrite, major scope change | `/flow-brief` or `/flow-prd` from scratch |

### Step 5 — Edit proposals (old → new format)

For each impacted artifact, propose **concrete** modifications:

```
**Artifact**: .agents/planning/prd.md
**Section**: Scope > IN
**Old**:
> - Feature X delivered in v1
**New**:
> - Feature X deferred to v2 (course-correct decision <date>)
**Reason**: <reported change>
```

### Step 6 — Sprint Change Proposal

Generate `.agents/implementation/sprint-change-proposal-<date>.md`:

```markdown
---
date: <date>
trigger: <summary>
scope: minor | moderate | major
---

# Sprint Change Proposal — <date>

## Issue Summary
<1-2 paragraphs>

## Impact Analysis
<impacted artifacts table>

## Recommended Approach
<reasoned recommendation, 5-10 lines>

## Detailed Changes
<list of old → new edit proposals>

## Implementation Handoff
- Next skill: `/flow-<name>`
- Stories impacted in sprint-status: <ids>
- Required user validations: <list>
```

### Step 7 — User validation
Present the proposal. Ask for explicit validation before any modification.

## Output

- `.agents/implementation/sprint-change-proposal-<date>.md` (created)
- **No other modification** until the user validates

## Next

Depending on scope:
- Minor → `/flow-story` or `/flow-quick`
- Moderate → `/flow-epics` then `/flow-sprint`
- Major → `/flow-prd` (and likely `/flow-architecture`)

Then update `sprint-status.yaml` with the new statuses (obsolete stories → `cancelled` or removed).
