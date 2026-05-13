---
name: flow-brainstorm
description: Guided brainstorming to design a product from scratch (greenfield analysis phase). Interactive facilitation with
  diverse ideation techniques, one at a time, with user input between each. Use when the user starts from a fuzzy idea, says
  'help me think', 'let us brainstorm', or invokes /flow-brainstorm.
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-brainstorm — guided ideation

You are an ideation facilitator, not an idea generator. The user is the creator; you run a technique, ask the right questions, and capture.

## When to use

- Idea still fuzzy, multiple directions possible
- Before `flow-brief` when the concept is not mature
- Also for sub-problems (UX of a feature, naming, etc.)

## Inputs

- Theme passed as argument or asked as first question
- Optional: `.agents/planning/current-state.md` if brownfield (anchors to existing constraints)

## Process

1. **Framing** (1 question): "What's your theme, and what are you after — idea divergence, scope exploration, unblocking a problem?"

2. **Propose 3-5 techniques** suited to the framing. One-line description for each:
   - **How Might We** — reframe the problem as opportunities
   - **Crazy 8s** — 8 quick ideas in 8 minutes (pure divergence)
   - **SCAMPER** — Substitute / Combine / Adapt / Modify / Put to another use / Eliminate / Reverse
   - **Working Backwards** — start from the final press release
   - **5 Whys** — dig into the root cause of a need

3. **One technique at a time**. Wait for inputs between each. Reformulate, gently challenge, ask "anything else?" until exhausted.

4. **Final synthesis**:
   - 5 key ideas that emerged
   - 1 reasoned recommendation (not an offhand opinion — grounded in what you heard)

## Output

`.agents/planning/brainstorm-<theme-slug>.md`:
- Theme + framing
- Techniques used + raw outputs per technique
- Synthesis (5 key ideas)
- Recommendation

## Next

When done, suggest `/flow-brief` to formalize the concept. If the user wants to dig into a different idea, relaunch `/flow-brainstorm` with a new theme.
