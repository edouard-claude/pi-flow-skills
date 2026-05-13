# pi-flow-skills

BMAD-inspired sprint workflow for [Pi](https://pi.dev). Carries a project from concept to ship: brainstorm → brief → PRD → architecture → epics → sprint → story-by-story implementation.

All artifacts are stored under `.agents/` at the project root (planning + implementation), feeding the next agent invocation with rich context.

## Requirements

- **OS**: macOS, Linux, or Windows via WSL / Git Bash. Not tested on native PowerShell.
- **`pi`** (≥ a recent build supporting `--print`, `--no-session`, `--mode json`, `--append-system-prompt`) — https://pi.dev
- **`bash`** ≥ 3.2 (default on macOS; any modern Linux)
- **`uv`** (provides `uvx`) — used to parse `sprint-status.yaml` with PyYAML on the fly. https://docs.astral.sh/uv/
- **`jq`** — used to format the streamed JSON event flow into readable output. Bypassable with `PI_RAW=1`.

The `flow-auto` orchestrator pre-checks all four. The individual skills (`flow-help`, `flow-prd`, etc.) only require `pi` itself.

## Installation

```bash
pi install git:github.com/edouard-claude/pi-flow-skills@v0.1.1
```

## Skills

| Skill | Phase | Purpose |
|---|---|---|
| `flow-help` | anytime | Entry point — diagnoses state, recommends next command |
| `flow-brainstorm` | analysis | Guided ideation (HMW, Crazy 8s, SCAMPER, Working Backwards, 5 Whys) |
| `flow-brief` | analysis | Product brief (4-stage elicitation) |
| `flow-introspect` | brownfield | Scans existing repo → `project-context.md` + `current-state.md` |
| `flow-prd` | planning | PRD with step-by-step menus and append-only doc |
| `flow-architecture` | solutioning | Technical decisions with explicit trade-offs |
| `flow-epics` | solutioning | Epics + stories with BDD acceptance criteria |
| `flow-sprint` | implementation | Sprint state machine (backlog → ready-for-dev → in-progress → review → done) |
| `flow-story` | implementation | Story CREATE — exhaustive context engine |
| `flow-dev` | implementation | DEV — red-green-refactor with halt conditions |
| `flow-review` | implementation | REVIEW — three adversarial reviewers (Blind / Edge Case / Acceptance) |
| `flow-commit` | implementation | Conventional commit + sprint-status update |
| `flow-quick` | anytime | Bypass for small tasks (< 1 day) |
| `flow-course-correct` | anytime | Mid-sprint scope change (Minor / Moderate / Major) |
| `flow-retro` | end of epic | Party-mode retrospective + critical readiness check |
| `flow-auto` | batch | Bash orchestrator looping `/flow-story → /flow-dev → /flow-review → /flow-commit` over all sprint stories, fresh Pi session per story |

## Typical sequence

**Greenfield:**
`/flow-help` → `/flow-brainstorm` → `/flow-brief` → `/flow-prd` → `/flow-architecture` → `/flow-epics` → `/flow-sprint` → `/flow-story` (loop) → `/flow-retro`

**Brownfield:**
`/flow-help` → `/flow-introspect` → branch as needed.

**Anytime:** `/flow-help`, `/flow-quick`, `/flow-course-correct`.

## flow-auto (batch mode)

Loops over all `ready-for-dev` stories in `sprint-status.yaml`, running each through the full CREATE → DEV → REVIEW → COMMIT cycle. Each step runs in a fresh Pi session (`pi --print --no-session`), equivalent to a `/clear` between stories.

```bash
bash ~/.pi/agent/skills/flow/flow-auto/run.sh
```

Requirements: `pi`, `uvx` (for YAML parsing), `jq` (for live event formatting).

Override defaults:
- `PI_MODE=text bash run.sh` — text output instead of streamed JSON events
- `PI_RAW=1 bash run.sh` — raw JSON passthrough (debug)
- `PI_BIN=/path/to/pi` — alternate Pi binary

## Artifact layout

```
.agents/
├── planning/
│   ├── brainstorm-<theme>.md
│   ├── product-brief.md
│   ├── current-state.md
│   ├── prd.md
│   ├── architecture.md
│   └── epics/
│       └── epic-XXX.md
├── implementation/
│   ├── sprint-status.yaml
│   ├── stories/
│   │   └── story-XXX.md
│   └── retro-epic-XXX.md
└── project-context.md
```

## Credits

Heavily inspired by [BMAD Method](https://docs.bmad-method.org) — same philosophy of phased, peer-collaborative workflows, adapted to Pi's skill primitives.

## License

MIT — see [LICENSE](LICENSE).
