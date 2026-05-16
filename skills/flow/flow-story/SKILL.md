---
name: flow-story
description: 'CREATE phase of a story: parent orchestrator that fans out parallel research (corpus map + conventions audit) via
  ephemeral Pi sub-agents, then writes a context-rich story file. Updates sprint-status.yaml backlog -> ready-for-dev.
  Use to prepare a story before /flow-dev.'
version: 0.4.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-story — context engine with parallel research wave

You are a peer developer in preparation mode. You don't code. You orchestrate a brief parallel research wave, then produce a story file rich enough for another LLM dev to implement without asking questions.

## When to use

- `backlog` story to prepare before implementation
- Re-preparation of a story whose context has changed
- First phase of the `flow-story → flow-dev → flow-review → flow-commit` cycle

## Inputs (required)

- `.agents/implementation/sprint-status.yaml` (locate the story)
- The parent epic in `.agents/planning/epics/`
- `.agents/planning/architecture.md` (if present)
- `.agents/project-context.md` (if present)

## Process

### Step 0 — Pre-research wave (parallel sub-agents)

This step is what makes the story rich without bloating the parent context. Two sub-agents run in parallel against the repo, then a synthesizer compacts their outputs.

**0.1 — Identify the story.** Find `<story-id>` in `sprint-status.yaml`. If not found, stop with the list of available stories. If already `ready-for-dev` and `$FLOW_AUTO=1`, exit 0 silently.

**0.2 — Locate the epic** that owns the story (e.g. `story-002-03` → `epic-002`). Read the epic file once.

**0.3 — Write the wave input.** Create `.agents/internal/<story-id>/_input.md`:

```markdown
STORY_ID: <story-id>
STORY_TITLE: <title from the epic>
STORY_SUMMARY:
<2-5 lines distilled from the epic's section for this story — intent + key acceptance signals>

EPIC_PATH: .agents/planning/epics/<epic-file>.md
ARCH_PATH: .agents/planning/architecture.md
TOUCHED_HINTS: <optional comma-separated hint paths, may be omitted>
```

Keep `STORY_SUMMARY` under 5 lines — the sub-agents read the epic/architecture themselves if needed.

**0.4 — Launch the wave.** Resolve the script path (handles both `pi install git:` and manual installs):

```bash
WAVE="$(find "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}" -path '*flow-story/wave-research.sh' 2>/dev/null | head -1)"
bash "$WAVE" <story-id>
```

The script spawns `research-corpus` + `research-conventions` in parallel (≈30-60s wall time), then runs `synthesize` over both. It writes:

```
.agents/internal/<story-id>/
├── _input.md         (you wrote this)
├── corpus.md         (corpus map: files to touch, tests, gaps)
├── conventions.md    (hard rules + tooling stack + observed patterns)
└── synthesis.md      (compact meta-prompt — your primary input for Steps 1-5)
```

**0.5 — Read `synthesis.md`** in full. Treat it as authoritative for files-to-touch and conventions. If `synthesis.md` flags `Confidence: Low`, fall through to the classic exhaustive sweep (Steps 2-3 below) as backup. If it says `skipped` (FLOW_PARALLEL=0), proceed as in v0.3 — full sweep.

### Step 1 — Discover target story (verify)
- Confirm `<story-id>` resolves in sprint-status
- If already `ready-for-dev` interactively, ask redo/skip; in batch (`$FLOW_AUTO=1`), skip silently

### Step 2 — Context cross-check (light, lean on synthesis)
- Use `synthesis.md` as the primary map
- Spot-check 1-2 neighbor stories in `.agents/implementation/stories/` for emerging patterns NOT yet in conventions
- `git log -10` only on files listed in `synthesis.md`'s "Files to touch"
- Architecture sections only for ambiguous decisions

### Step 3 — Architecture compliance
For each touched component from `synthesis.md`:
- What pattern does the repo already use? (already in `conventions.md`)
- Which files UPDATE / CREATE / DELETE? (already in `synthesis.md`)
- Which existing tests must not break? (already in `corpus.md`)

If gaps remain after the wave, do targeted reads.

### Step 4 — Web research (if relevant)
Only if `synthesis.md` flags an external lib or third-party API as in scope.

### Step 5 — Produce the story file

`.agents/implementation/stories/story-<id>.md`:

```markdown
---
storyId: story-001-01
epic: epic-001
status: ready-for-dev
size: M
created: <date>
---

# story-001-01 — <title>

## User story description
As a ..., I want ..., so that ...

## Acceptance criteria
- [ ] Given ..., when ..., then ...

## Context
<distilled from synthesis.md TL;DR + epic + project-context — no padding>

## Files to touch
- CREATE: <path> — <reason>
- UPDATE: <path> — <reason>
- DELETE: <path> — <reason>

## Implementation plan (5-10 steps)
1. ...

## Tests to write / pass
- Unit: ...
- Integration: ...
- E2E: ...

## Dev notes (guardrails)
- Conventions to respect: <bullets from conventions.md, source preserved>
- Known traps: <from corpus.md "Suspected gaps" or contradictions section>
- Out of scope: <what we do NOT touch>

## Change log
- <date>: story created (wave: <count files mapped>, confidence: <synthesis confidence>)
```

### Step 6 — Update sprint-status

Edit only `development_status[<story-id>]` from `backlog` to `ready-for-dev`. Do NOT touch the `dependencies` block — it's auto-managed by `/flow-sprint`.

## Output

- `.agents/implementation/stories/story-<id>.md`
- `.agents/internal/<story-id>/{_input,corpus,conventions,synthesis}.md` (transient — informational, may be cleaned periodically)
- `sprint-status.yaml` updated

## Next

- `/flow-dev <id>` to implement (reads the story file produced here)

## Batch mode (`$FLOW_AUTO=1`)

When set by `flow-auto/run.sh`:
- No user question. No menu.
- If the story is already `ready-for-dev`, exit 0 silently.
- Wave runs unconditionally unless `FLOW_PARALLEL=0` is also set.
- Halt condition (story not found, dependency unsatisfied) → exit non-zero.

## Fallback

`FLOW_PARALLEL=0` disables the wave. The skill then behaves as v0.3:
classic exhaustive context gathering from epic + architecture + neighbor
stories + git log + tests. Use when sub-agent calls fail or for offline runs.
