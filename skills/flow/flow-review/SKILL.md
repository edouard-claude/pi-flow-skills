---
name: flow-review
description: 'REVIEW phase of a story: parent orchestrator that fans out 3 adversarial reviewers (Blind Hunter, Edge Case Hunter,
  Acceptance Auditor) as parallel ephemeral Pi sub-agents, synthesizes their findings, then triages into
  Blockers/Should-fix/Nice-to-have/Noise. Adds [AI-Review] action items OR Senior Review section to the story file. Keeps
  sprint-status review (approved) OR sends back to in-progress. Use after /flow-dev.'
version: 0.6.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-review — parallel adversarial review

You orchestrate three reviewers running in parallel ephemeral Pi sessions, then triage their consolidated findings. No complacency about your own code from earlier — the reviewers are fresh sessions and have never seen the parent context.

## When to use

- Story `review` in sprint-status after `/flow-dev`
- Before `/flow-commit`

## Inputs (required)

- `.agents/implementation/stories/story-<id>.md` (with File List + Dev Notes)
- The recent diff (touched files from the story's File List)
- `.agents/project-context.md`
- `.agents/planning/architecture.md` for compliance check

## Process

### Step 1 — Launch the review wave

Spawn three reviewers in parallel via the companion wave script. Resolve the path:

```bash
WAVE="$(find "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}" -path '*flow-review/wave-review.sh' 2>/dev/null | head -1)"
bash "$WAVE" <story-id>
```

The script:
- Extracts touched paths from the story's `## File List` (fallback: `git diff --name-only`).
- Spawns `review-blind` + `review-edge-cases` + `review-acceptance` in parallel (≈45-90s wall time).
- Runs `synthesize` over the three outputs.
- Writes everything under `.agents/internal/<story-id>-review/`.

If the script fails or `FLOW_PARALLEL=0`, fall through to **Fallback** (Step 1bis below) and do the three reviews inline as in v0.3.

### Step 1bis — Fallback (only if wave failed / FLOW_PARALLEL=0)

Play the three reviewers in your head, sequentially:

- **Blind Hunter** — read the diff without re-reading the story; hunt bugs, smells, naming.
- **Edge Case Hunter** — enumerate empty/null/concurrency/network/permission/migration edge cases.
- **Acceptance Auditor** — for each AC, verify the code actually satisfies it (not coincidental green tests).

### Step 2 — Read the synthesis

Read `.agents/internal/<story-id>-review/synthesis.md` in full. It gives you:
- TL;DR (3 actionable insights)
- Files to touch (consolidated)
- Contradictions between reviewers
- Confidence level

Also read the three raw reports (`blind.md`, `edge-cases.md`, `acceptance.md`) for anything the synthesis flagged as a blocker — never approve based on synthesis alone when blockers are present.

### Step 3 — Triage findings (final decision)

Reclassify every finding into one of:
- **Blocker** — must-fix before `done`. Correctness, security, data loss, contract violation, unsatisfied AC.
- **Should-fix** — must fix unless written justification. Performance regression risk, brittle test, missing edge case with realistic trigger.
- **Nice-to-have** — debt log, non-blocking. Style, minor naming, future-proofing.
- **Noise** — false positive, out of story scope. Drop.

The synthesizer suggested severities; you adjudicate. Demote eagerly — a blocker that turns out to be a stylistic concern undermines the whole review.

### Step 4 — Action items

#### If **blockers or should-fix** present

Append to the bottom of the story file:

```markdown
## [AI-Review] Action items — <date>

### Blockers
- [ ] <precise description + file:line if relevant>

### Should-fix
- [ ] <description>

### Nice-to-have (debt)
- [ ] <description>
```

Edit only `development_status[<story-id>]` from `review` to `in-progress`. Findings live in the story file, never in `sprint-status.yaml`.

#### If **clean** (only optional nice-to-have or none)

Append a **Senior Review** section to the story file:

```markdown
## Senior Review — <date>

- Blind Hunter: <synthesis line — clear or notable observations>
- Edge Case Hunter: <synthesis line — coverage summary + any nice-to-haves>
- Acceptance Auditor: <synthesis line — N/N AC satisfied>

**Verdict**: approved.
```

Don't touch sprint-status — keep `development_status[<id>]: review` as-is (waiting for `/flow-commit`).

## Output

- Enriched story file (Action items OR Senior Review)
- sprint-status updated per verdict
- `.agents/internal/<story-id>-review/{blind,edge-cases,acceptance,synthesis}.md` (transient — informational)

## Next

- Verdict **clean** → `/flow-commit <id>`
- Items to handle → `/flow-dev <id>` (dev/review cycle until clean)
- Major blocker that suggests scope drift → `/flow-course-correct`

## Batch mode (`$FLOW_AUTO=1`)

- Same flow, no user pause.
- `run.sh` already enforces a max of 3 dev↔review cycles. After that it aborts the loop with a clear error.

## Fallback

`FLOW_PARALLEL=0` disables the wave. The skill then behaves as v0.3:
inline mental play of the three angles, sequential. Use when sub-agent calls
fail, for offline runs, or to A/B-compare wave vs inline review quality.
