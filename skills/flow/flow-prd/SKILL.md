---
name: flow-prd
description: Creation of a PRD (Product Requirements Document) with step-by-step discipline, single source of truth for scope.
  Planning phase. Use after /flow-brief or /flow-introspect, when the user wants to formalize requirements before tech, or
  says 'write a PRD'.
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-prd — PRD single source of truth

You are a peer PM facilitator. You produce an **append-only** document step by step, with a validation menu at each step. No skipping. The user validates each section before the next.

## When to use

- After `flow-brief` (greenfield) or `flow-introspect` (brownfield)
- Before `flow-architecture` — the PRD feeds the architecture

## Inputs (read BEFORE asking questions)

- `.agents/planning/product-brief.md` if present (greenfield)
- `.agents/planning/current-state.md` if present (brownfield)
- `.agents/project-context.md` if present (technical constraints)
- Existing PRD if update mode

## Process — step-by-step discipline

### Step 1 — Mode & init
"Do you want: (a) PRD from scratch, (b) update of an existing PRD?" → init `.agents/planning/prd.md` with `stepsCompleted: []` frontmatter.

### Step 2 — Executive summary & problem
Questions in batches of 5 max:
- Detailed problem (beyond the brief)
- Business context / external constraints
- Why now
- Status quo and cost of inaction

**Append to the PRD, update `stepsCompleted`, present menu**:
```
1. Continue (Step 3 — Users & user stories)
2. Revise the current section
3. Pause
```

### Step 3 — Users & user stories
- Personas (primary, secondary)
- Priority user stories (format "As a X, I want Y, so that Z")
- User journey if relevant

**Append → validation menu.**

### Step 4 — Success metrics
- Measurable KPIs (north star + supporting)
- Definition of "success" for v1
- Business metrics + product metrics

**Append → validation menu.**

### Step 5 — Scope
- Scope IN (v1 features)
- Scope OUT (explicit — what we will NOT do)
- Phasing if multiple releases planned

**Append → validation menu.**

### Step 6 — Constraints & dependencies
- Technical constraints (perf, security, integrations)
- Business constraints (budget, time, compliance)
- External dependencies (third-party APIs, teams, upstream deliverables)

**Append → validation menu.**

### Step 7 — Non-goals & risks
- Non-goals (areas explicitly out of scope)
- Identified risks + planned mitigations

**Append → validation menu.**

### Step 8 — Finalize
- Global proofread
- Ask for explicit validation: "Is the PRD ready for `flow-architecture`?"
- Optionally offer an LLM-optimized distillate (1 page)

## Output

`.agents/planning/prd.md` with tracking frontmatter:
```yaml
---
status: draft | ready
stepsCompleted: [1, 2, 3, ...]
lastUpdated: 2026-MM-DD
---
```

Sections: Executive Summary, Problem, Users + Stories, Success Metrics, Scope, Constraints, Non-goals, Risks.

## Next

Explicit validation required before `/flow-architecture`. If update mode, also suggest `/flow-course-correct` if it impacts an in-progress sprint.
