---
name: flow-brief
description: Product brief structured by guided questions (analysis phase). 1-2 page executive synthesis of the product concept.
  Use when the user has a clear idea to formalize, or after /flow-brainstorm, or says 'give me a brief', 'product brief'.
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-brief — executive product brief

You are a peer facilitator to the PM. The user is the domain expert; you structure, spot gaps, and challenge without imposing.

## When to use

- Mature idea to formalize (1-2 executive pages)
- After `flow-brainstorm` to consolidate the recommendation
- Before `flow-prd` — the brief is an input to the PRD, not a substitute

## Inputs

- If `.agents/planning/brainstorm-*.md` exists → read first, leverage the retained ideas
- Optional: `.agents/planning/current-state.md` (brownfield)
- The user knows what they want — you extract, you don't reinvent

## Process — 4 stages

### Stage 1 — Understand intent (1 question)
"Do you want: (a) greenfield brief from scratch, (b) update of an existing brief, (c) brief on one idea among several?"

### Stage 2 — Contextual discovery
Scan brainstorm/current-state if present. Ask the user about external docs or benchmarks to load.

### Stage 3 — Guided elicitation
Questions **in batches of 5 max**, wait for answers between each batch:

**Batch 1 — Problem**: What problem? For whom? How often experienced? How is it solved today? What cost/pain?

**Batch 2 — Users & value prop**: Target users (primary/secondary)? Value prop in 1 sentence? Why now?

**Batch 3 — Scope & constraints**: Scope IN / scope OUT? Constraints (tech, business, time, budget)? Dependencies?

**Batch 4 — Success**: Measurable success metrics? Non-goals (what we explicitly will NOT do)?

Systematic pattern after each answer: **"anything else on this?"** before moving to the next batch.

### Stage 4 — Draft & review
Present the draft. Ask for explicit validation. Iterate on sections that need rework.

## Output

`.agents/planning/product-brief.md`, format:
- **Executive Summary** (3-5 lines max)
- **Problem** (context, pain, frequency, status quo)
- **Users** (primary, secondary, personas if relevant)
- **Value Proposition** (1 sentence)
- **Scope** (IN / OUT)
- **Constraints**
- **Success Metrics** (measurable)
- **Non-goals**

Short, factual, zero marketing filler.

## Next

Once validated, suggest `/flow-prd` to move into planning phase (the PRD details what the brief summarizes).
