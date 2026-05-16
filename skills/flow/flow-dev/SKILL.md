---
name: flow-dev
description: 'DEV phase of a story: parent orchestrator that fans out 3 pre-dev sub-agents (find-similar-impl, check-dependencies,
  enumerate-tests) in parallel, then runs red-green-refactor per task using the synthesized context. Strict respect of
  project-context, comprehensive tests, halt conditions. Updates sprint-status ready-for-dev -> in-progress -> review. Use after
  /flow-story.'
version: 0.7.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-dev — red-green-refactor with parallel pre-dev wave

You are a developer in execution mode. The story file is your brief, augmented at runtime by a parallel research wave that locates reusable prior art, coupling risks, and existing test surface. You code continuously. No pause except a halt condition.

## When to use

- `ready-for-dev` story after `/flow-story`
- Resuming an `in-progress` or `review` story with unresolved `[AI-Review]` items

## Inputs (required)

- `.agents/implementation/stories/story-<id>.md`
- `.agents/implementation/sprint-status.yaml`
- `.agents/project-context.md` (strict conventions)
- Optional: `.agents/planning/architecture.md`

## Process

### Step 1 — Mark in-progress

Edit only `development_status[<story-id>]` from `ready-for-dev` (or `in-progress` if resuming) to `in-progress`. Never add new keys. Never touch the `dependencies` block.

### Step 2 — Detect review continuation

If resuming from `review` with `[AI-Review]` items, address those first. Skip Step 3 (wave) — you already have the context from the prior cycle.

### Step 3 — Pre-dev research wave (fresh dev cycles only)

Three parallel ephemeral Pi sub-agents map the surrounding territory so you don't reinvent or break parallel work. Resolve the script path:

```bash
WAVE="$(find "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}" -path '*flow-dev/wave-dev.sh' 2>/dev/null | head -1)"
bash "$WAVE" <story-id>
```

The script writes:

```
.agents/internal/<story-id>-dev/
├── similar-impl.md     prior implementations to reuse / adapt
├── dependencies.md     coupling with other stories / contract changes
├── tests.md            existing tests to preserve + scaffolding needed
└── synthesis.md        compact meta-prompt — read this first
```

Read `synthesis.md` in full. Use it to:
- **Prefer reuse over rewrite** when a `direct-reuse` candidate exists
- **Pin signatures** when `dependencies.md` flags downstream consumers
- **Preserve existing test names/assertions** listed in `tests.md` (changes to those are breaking changes that need explicit justification)

If `synthesis.md` is empty or flagged `skipped`/`failed`, proceed without it — Step 4 stays the same.

### Step 4 — Red-green-refactor per task

For each step of the story's Implementation plan:

1. **Red** — write or identify the test that must pass. If `tests.md` listed an existing test for this surface, START by running it to confirm baseline.
2. **Green** — implement the minimum. Reuse candidates from `similar-impl.md` before writing new code.
3. **Refactor** — clean while keeping tests green. Respect signatures pinned by `dependencies.md`.

**No pause for intermediate milestones.** Run continuously until completion OR halt condition.

### Step 5 — Halt conditions

- Architecture decision ambiguous, not covered by `architecture.md` and not resolvable from synthesis
- Missing dependency / third-party API unavailable
- Test impossible to write for an AC (escalate)
- Conflict with an undocumented convention (escalate, propose project-context update)
- Coupling risk from `dependencies.md` materializes (parallel story would break)

**Interactive mode**: stop, ask the user.
**Batch mode (`$FLOW_AUTO=1`)**: write the blocker into the story file's **Dev Notes**, leave the story `in-progress`, exit non-zero. The user resumes via `/flow-dev <id>`.

### Step 6 — Comprehensive tests

Write every test required by the AC. No fake-it, no skip. Run the suite after each major step. Tests listed in `tests.md` must still pass — if you intentionally invalidate one, document why in Dev Notes.

### Step 7 — Internal validation

- All AC checkable
- All tests pass (entire suite, not just new ones)
- No TODOs left, no dead code
- Project-context conventions respected
- Coupling notes from `dependencies.md` addressed

### Step 8 — Mark review

Update the story file:
- Status → `review`
- **File List** (touched files CREATE/UPDATE/DELETE) — used by `/flow-review`'s wave
- **Change Log** entry with date
- **Dev Notes**: decisions made, surprises encountered, emerging patterns, **wave handoff outcomes** (which reuse candidates worked, which coupling notes proved real)

Edit only `development_status[<story-id>]` from `in-progress` to `review`.

## Output

- Code + tests in the repo
- Enriched story file (File List, Change Log, Dev Notes)
- sprint-status updated
- `.agents/internal/<story-id>-dev/` transient artifacts

## Next

`/flow-review <id>` for adversarial review before commit.

## Batch mode (`$FLOW_AUTO=1`)

- No user pause. No question.
- Wave runs unconditionally unless `FLOW_PARALLEL=0`.
- Red-green-refactor continuous until completion OR halt condition.
- Halt → exit non-zero.

## Fallback

`FLOW_PARALLEL=0` disables the wave. The skill then behaves as v0.3:
red-green-refactor directly from the story file, no pre-dev sub-agents.
Use when sub-agent calls fail or for offline runs.
