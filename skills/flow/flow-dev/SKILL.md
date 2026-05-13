---
name: flow-dev
description: 'DEV phase of a story: red-green-refactor per task, strict respect of project-context, comprehensive tests, halt
  conditions. Updates sprint-status ready-for-dev -> in-progress -> review. Use after /flow-story on a ready-for-dev story.
  No pause except for an explicit halt condition.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-dev — red-green-refactor implementation

You are a developer in execution mode. The story file is your brief. You code continuously, you write the tests, you validate. No pause except for a halt condition.

## When to use

- `ready-for-dev` story after `/flow-story`
- Resuming an `in-progress` or `review` story with unresolved `[AI-Review]` items

## Inputs (required)

- `.agents/implementation/stories/story-<id>.md` (the full brief)
- `.agents/implementation/sprint-status.yaml`
- `.agents/project-context.md` (strict conventions)
- Optional: `.agents/planning/architecture.md` for ambiguous decisions

## Process

### Step 1 — Mark in-progress
Update sprint-status: `ready-for-dev` → `in-progress`, `currentStory = <id>`.

### Step 2 — Detect review continuation
If the story was in `review` with unresolved `[AI-Review]` items, read them and address them first.

### Step 3 — Red-green-refactor per task

For each step of the story file's implementation plan:
1. **Red**: write/identify the test that must pass
2. **Green**: implement the minimum to make it pass
3. **Refactor**: clean up while keeping tests green

**No pause for intermediate milestones.** Run continuously until completion OR halt condition.

### Step 4 — Halt conditions

- Architecture decision ambiguous, not covered by `architecture.md`
- Missing dependency / third-party API unavailable
- Test impossible to write for an AC
- Conflict with an undocumented convention (to be added to project-context)

**Interactive mode**: stop, ask the user.
**Batch mode (`$FLOW_AUTO=1`)**: ask nothing. Write what blocks into the story file's **Dev Notes** section + leave the story `in-progress`, then exit non-zero to stop `flow-auto/run.sh`. The user resumes manually later via `/flow-dev <id>`.

### Step 5 — Comprehensive tests
Write all the tests required by the AC. No fake-it, no skip. Run the suite after each major step.

### Step 6 — Internal validation
- All AC checkable
- All tests pass (not just the new ones)
- No TODOs left, no dead code
- Project-context conventions respected

### Step 7 — Mark review
Update the story file:
- Status → `review`
- Add **File List** (touched files CREATE/UPDATE/DELETE)
- Add **Change Log** entry with date
- Add **Dev Notes**: decisions made, surprises encountered, emerging patterns

Update sprint-status: `in-progress` → `review`.

## Output

- Code + tests in the repo
- Enriched story file (File List, Change Log, Dev Notes)
- sprint-status updated

## Next

`/flow-review <id>` for adversarial review before commit.

## Batch mode (`$FLOW_AUTO=1`)

- No user pause. No question.
- Red-green-refactor cycle continuous until completion OR halt condition (see Step 4).
- Halt condition → exit non-zero (the `flow-auto/run.sh` script stops the loop).
- Completion → story moves to `review`, exit 0.
