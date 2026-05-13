---
name: flow-auto
description: 'Orchestrator that loops through every ready-for-dev story in the sprint in order, chaining /flow-story -> /flow-dev
  -> /flow-review -> /flow-commit with a fresh Pi session per story (equivalent to /clear). Skill = doc + companion run.sh.
  Launch: bash ~/.pi/agent/skills/flow/flow-auto/run.sh'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-auto — multi-story orchestration

This skill is **not executed by the LLM** in the classic sense. It is documentation for the **companion bash script** that drives Pi in `--print --no-session` mode to loop over the sprint stories.

## Concept

A Pi skill is text instructions, not a program. To orchestrate multiple Pi invocations (including `/clear` between each), you need an **external script** that runs Pi in non-interactive mode.

## The companion script

`~/.pi/agent/skills/flow/flow-auto/run.sh`

For each `ready-for-dev` story (or `backlog` with satisfied dependencies):
1. `pi --print --no-session "/flow-story <id>"`
2. `pi --print --no-session "/flow-dev <id>"`
3. `pi --print --no-session "/flow-review <id>"`
4. `pi --print --no-session "/flow-commit <id>"`

`--no-session` = ephemeral session = equivalent to `/clear` between each call.

The loop stops when:
- No more `ready-for-dev` or `backlog` story with satisfied dependencies
- A step fails (pi exit != 0)
- A story moves to `blocked`

## Launch

```bash
bash ~/.pi/agent/skills/flow/flow-auto/run.sh [path/sprint-status.yaml]
```

Default argument: `.agents/implementation/sprint-status.yaml`

## Requirements

- `sprint-status.yaml` up to date (run `/flow-sprint` first if needed)
- Skills `flow-story`, `flow-dev`, `flow-review`, `flow-commit` installed
- Pi installed (`/opt/homebrew/bin/pi` or equivalent)
- `uvx` to parse YAML (auto-installed via the script's PEP 723 header)
- `jq` to format the live JSON stream (bypassable with `PI_RAW=1`)

## Guarantees / non-guarantees

**Guarantees**:
- Order respected (topological sort of dependencies)
- A complete story = 1 full Pi cycle (CREATE → DEV → REVIEW → COMMIT)
- Fresh context between stories (`--no-session`)

**Does NOT guarantee**:
- That `/flow-dev` finishes without a halt condition (human may be required)
- That `/flow-review` approves on first pass (dev↔review cycles possible)
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
