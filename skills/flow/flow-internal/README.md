# flow-internal — sub-agent prompt templates

These are **NOT skills**. They are system-prompt fragments injected into ephemeral Pi sub-processes via `pi --print --no-session --append-system-prompt @<file>.md "<task>"`.

Pi only scans `skills/flow/*/SKILL.md` at one depth, so files in `flow-internal/` are deliberately invisible to slash-command resolution.

## Conventions

Each sub-agent file is a flat Markdown system prompt with:

1. **Role line** — one sentence persona
2. **Inputs** — what the parent guarantees in the task argument
3. **Process** — bullet list, no narrative
4. **Output schema** — strict markdown sections; sub-agent writes ONLY this to stdout
5. **Token budget** — explicit word/line ceiling
6. **Halt rules** — when to short-circuit with `N/A` to save tokens

Sub-agents are **fresh-context** (no parent history), **read-only on the repo**, and write nothing to disk themselves. The parent's wave script captures their stdout into `.agents/internal/<story-id>/<agent>.md`.

## Current roster

| File | Spawner | Purpose |
|---|---|---|
| `research-corpus.md` | `flow-story` | Map repo files relevant to the upcoming story |
| `research-conventions.md` | `flow-story` | Surface project conventions affecting the story |
| `synthesize.md` | `flow-story` / `flow-dev` / `flow-review` | Compress parallel outputs into a meta-prompt |
| `find-similar-impl.md` | `flow-dev` (v0.7) | Locate prior implementations of similar logic |
| `check-dependencies.md` | `flow-dev` (v0.7) | Detect coupling with other stories/epics |
| `enumerate-tests.md` | `flow-dev` (v0.7) | List tests to preserve/adapt |
| `memory-condenser.md` | `flow-retro` (v0.5) | Distill an epic's artifacts into `.agents/memory/` diffs |

## Why no YAML frontmatter

These files are `cat`-ed and passed verbatim as a system prompt. Frontmatter would leak into the model context. Keep the file body pure instructions.

## Adding a new sub-agent

1. Drop `<name>.md` here, no frontmatter.
2. Add an entry to the roster above.
3. Wire it from a parent skill via the wave script pattern (`skills/flow/<parent>/wave-*.sh`).
4. Never reference it from a slash-command help line — it's internal.
