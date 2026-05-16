---
name: flow-auto
description: 'Orchestrator that loops through every ready-for-dev story in the sprint in order, chaining /flow-story -> /flow-dev
  -> /flow-review -> /flow-commit with a fresh Pi session per story (equivalent to /clear). Skill = doc + companion run.mjs
  (self-contained Node ESM bundle, no extra deps). Launch:
  ~/.pi/agent/git/github.com/edouard-claude/pi-flow-skills/skills/flow/flow-auto/run.mjs'
version: 0.9.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-auto — multi-story orchestration

This skill is **not executed by the LLM** in the classic sense. It is documentation for the **companion `run.mjs` script** that drives Pi in `--print --no-session` mode to loop over the sprint stories.

## Concept

A Pi skill is text instructions, not a program. To orchestrate multiple Pi invocations (including `/clear` between each), you need an **external script** that runs Pi in non-interactive mode. Since v0.9.0, that script is a single self-contained ESM bundle that runs on the Node already bundled with Pi — no `bash`, `python`, `uvx`, or `jq` needed.

## The companion script

`~/.pi/agent/git/github.com/edouard-claude/pi-flow-skills/skills/flow/flow-auto/run.mjs`

For each `ready-for-dev` story (or `backlog` with satisfied dependencies):
1. `pi --print --no-session "/flow-story <id>"`
2. `pi --print --no-session "/flow-dev <id>"`
3. `pi --print --no-session "/flow-review <id>"` (up to 3 dev↔review cycles)
4. `pi --print --no-session "/flow-commit <id>"`

`--no-session` = ephemeral session = equivalent to `/clear` between each call.

The loop stops when:
- No more `ready-for-dev` or `backlog` story with satisfied dependencies
- A step fails (pi exit != 0)
- A story moves to `blocked`
- More than 3 dev↔review cycles on the same story

## Launch

```bash
~/.pi/agent/git/github.com/edouard-claude/pi-flow-skills/skills/flow/flow-auto/run.mjs [path/sprint-status.yaml]
```

The `#!/usr/bin/env node` shebang resolves Node automatically. Default argument: `.agents/implementation/sprint-status.yaml`.

## Requirements

- `sprint-status.yaml` up to date (run `/flow-sprint` first if needed)
- Skills `flow-story`, `flow-dev`, `flow-review`, `flow-commit` installed
- Pi installed (the Node it ships with is enough)

That's it. No `bash`, no `python`, no `uvx`, no `jq`. The bundle embeds `yaml` for parsing and a built-in JSON event stream parser.

## Environment knobs

- `PI_MODE=text` — text output instead of streamed JSON events
- `PI_RAW=1` — raw JSON passthrough (debug)
- `PI_BIN=/path/to/pi` — alternate Pi binary
- `NO_COLOR=1` — disable ANSI colors
- `NO_STICKY_HEADER=1` — disable the sticky top header
- `FLOW_PARALLEL=0` — disable all parallel waves (v0.3-equivalent inline behavior)

## Guarantees / non-guarantees

**Guarantees**:
- Order respected (topological sort of dependencies)
- A complete story = 1 full Pi cycle (CREATE → DEV → REVIEW → COMMIT)
- Fresh context between stories (`--no-session`)
- Idempotent resume after crash (each phase reads sprint-status and skips if already advanced)

**Does NOT guarantee**:
- That `/flow-dev` finishes without a halt condition (human may be required)
- That `/flow-review` approves on first pass (dev↔review cycles allowed up to 3)
- That commits are pushed (never without explicit user request)

## When to prefer manual

- First story of a project (calibrates expectations)
- Story with likely halt conditions (ambiguous decisions)
- Need for human validation between phases

`flow-auto` is built for **batch** runs over straightforward stories, not stories requiring close supervision.

## Next

- Run finished without error → `/flow-retro` if epic complete
- Halt mid-way → manual resume with `/flow-dev` or `/flow-review`
- Everything done → `/flow-help` to decide what's next
