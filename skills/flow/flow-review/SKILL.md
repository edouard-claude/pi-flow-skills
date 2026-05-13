---
name: flow-review
description: 'REVIEW phase of a story: parallel adversarial review with 3 reviewers (Blind Hunter, Edge Case Hunter, Acceptance
  Auditor), triage of findings into Blockers/Should-fix/Nice-to-have/Noise, [AI-Review] action items added to the story file
  when rework is needed. Keeps sprint-status review (approved) OR sends back to in-progress. Use after /flow-dev.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-review — parallel adversarial review

You play three reviewers in parallel in your head, then synthesize. No complacency about your own code from earlier — read the diff as if discovering it fresh.

## When to use

- Story `review` in sprint-status after `/flow-dev`
- Before `/flow-commit`

## Inputs (required)

- `.agents/implementation/stories/story-<id>.md` (with File List + Dev Notes)
- Recent git diff (`git diff` on the files from the File List)
- `.agents/project-context.md`
- `.agents/planning/architecture.md` for compliance check

## Process

### Step 1 — Load context
- Read the full story file (AC, Implementation Plan, Dev Notes)
- Read the diff of the touched files
- Read the added/modified tests

### Step 2 — Three review angles in parallel

#### Blind Hunter
Reads the diff without re-reading the story file. Hunts bugs, suspicious behavior, code smells, bad naming. Stance: "I have no context, what do I see?"

#### Edge Case Hunter
Systematically enumerates edge cases:
- Empty / null / undefined / negative / overflow inputs
- Concurrency (workers, transactions, races)
- Network errors, timeouts, partial failures
- Permissions / RLS / multi-tenancy
- Data migration (legacy records)

For each edge case: is it covered? tested?

#### Acceptance Auditor
For each AC of the story file, verify it is **actually** satisfied by the code (not just a test that passes by coincidence). Ask: "if I had to demo this to a PM, does the code do what it promises?"

### Step 3 — Triage findings

Classify **each** finding:
- **Blockers**: must-fix before `done`
- **Should-fix**: must fix unless written justification
- **Nice-to-have**: tag debt log, non-blocking
- **Noise**: ignore (false positive, out of story scope)

### Step 4 — Action items

#### If **blockers or should-fix** present
Append a section at the bottom of the story file:
```markdown
## [AI-Review] Action items — <date>

### Blockers
- [ ] <precise description + file:line if relevant>

### Should-fix
- [ ] <description>

### Nice-to-have (debt)
- [ ] <description>
```

Update sprint-status: `review` → `in-progress` (back to `/flow-dev` to handle the items).

#### If **clean** (only optional nice-to-have)
Append a **Senior Review** section to the story file:
```markdown
## Senior Review — <date>

- Blind Hunter: <synthesis — clear or notes>
- Edge Case Hunter: <synthesis>
- Acceptance Auditor: <synthesis>

**Verdict**: approved.
```

Update sprint-status: keep `review` (waiting for `/flow-commit`).

## Output

- Enriched story file (Action items OR Senior Review)
- sprint-status updated per verdict

## Next

- Verdict **clean** → `/flow-commit <id>`
- Items to handle → `/flow-dev <id>` (dev/review cycle until clean)
- Major blocker identified → `/flow-course-correct`
