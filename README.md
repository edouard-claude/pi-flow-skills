# pi-flow-skills

```
─────────────────────────────────────────────────────────────────────────────
                            pi-flow-skills
            BMAD sprint workflow  ·  parent + parallel sub-agents
─────────────────────────────────────────────────────────────────────────────

  planning      brainstorm → brief → prd → arch → epics → sprint
                                                              │
                                                              ▼
  per story    ┌──────────────────────────────────────────────────────┐
   (loop)      │   /flow-story        /flow-dev         /flow-review  │
               │        │                  │                  │       │
               │        ▼                  ▼                  ▼       │
               │   ┌────────┐         ┌────────┐         ┌────────┐   │
               │   │  wave  │         │  wave  │         │  wave  │   │
               │   └───┬────┘         └───┬────┘         └───┬────┘   │
               │       │                  │                  │        │
               │   ┌───┼───┐          ┌───┼───┐          ┌───┼───┐    │
               │   ▼   ▼   ▼          ▼   ▼   ▼          ▼   ▼   ▼    │
               │ corpus conv synth  sim deps tests     blind edge acc │
               │                          synth              synth    │
               │                                                      │
               │             pi --print --no-session                  │
               │           ephemeral parallel sub-agents              │
               └──────────────────────────────────────────────────────┘
                                       │
                                       ▼
                                  /flow-commit
                                       │
                                       ▼
  closeout     /flow-retro ──► memory-condenser ──► .agents/memory/
                                                    overview  decisions
                                                    lessons   journal
                                                    glossary
                                                          ▲
                                                          │
  return       flow-help  (cold-start ≥30 days)  ·  flow-recall  (Layer 0)

─────────────────────────────────────────────────────────────────────────────
```

BMAD-inspired sprint workflow for [Pi](https://pi.dev). Carries a project from concept to ship: brainstorm → brief → PRD → architecture → epics → sprint → story-by-story implementation → retrospective with **long-term memory**.

Since v0.4, the implementation phases (`flow-story`, `flow-dev`, `flow-review`) are **parent orchestrators** that fan out parallel ephemeral Pi sub-agents (research, prior-art, coupling, test-inventory, three adversarial reviewers) and synthesize their outputs before acting. Since v0.5, `flow-retro` populates a long-term memory layer at `.agents/memory/` so that opening the project again six or twelve months later puts the context back in your hands in under five minutes.

All artifacts are stored under `.agents/` at the project root, feeding the next agent invocation with rich context.

## Requirements

- **OS**: macOS, Linux, or Windows. Pure Node, no shell-specific bits.
- **`pi`** (≥ a recent build supporting `--print`, `--no-session`, `--mode json`, `--append-system-prompt`) — https://pi.dev

Since v0.9.0 every companion script is a self-contained ESM bundle (`.mjs` with `#!/usr/bin/env node` shebang). The Node runtime that ships with Pi is enough. No `bash`, no `python`, no `uvx`, no `jq` — that's the whole point of the v0.9 migration.

## Installation

```bash
pi install git:github.com/edouard-claude/pi-flow-skills@v0.9.0
```

## Skills (public surface)

The user-facing surface is unchanged from v0.3 — same 18 slash-commands, same arguments. Internal mechanics evolve under the hood (parallel sub-agents, memory layer).

| Skill | Phase | Purpose |
|---|---|---|
| `flow-help` | anytime | Orientation — detects current phase, recommends ONE next command. **v0.5+** also detects cold-start (≥30 days inactivity) and prefixes its output with a Welcome-back panel sourced from `.agents/memory/`. |
| `flow-status` | anytime | Pure sprint dashboard (epics + stories with status symbols). Cheap, read-only. |
| `flow-brainstorm` | analysis | Guided ideation (HMW, Crazy 8s, SCAMPER, Working Backwards, 5 Whys) |
| `flow-brief` | analysis | Product brief (4-stage elicitation) |
| `flow-introspect` | brownfield | Scans existing repo → `project-context.md` + `current-state.md` |
| `flow-prd` | planning | PRD with step-by-step menus and append-only doc |
| `flow-architecture` | solutioning | Technical decisions with explicit trade-offs |
| `flow-epics` | solutioning | Epics + stories with BDD acceptance criteria |
| `flow-sprint` | implementation | Sprint state machine (backlog → ready-for-dev → in-progress → review → done) |
| `flow-story` | implementation | Story CREATE. **v0.4+** parent of `research-corpus` + `research-conventions` (parallel) + `synthesize`. |
| `flow-dev` | implementation | Red-green-refactor. **v0.7+** parent of `find-similar-impl` + `check-dependencies` + `enumerate-tests` (parallel) + `synthesize`. |
| `flow-review` | implementation | **v0.6+** parent of `review-blind` + `review-edge-cases` + `review-acceptance` (parallel) + `synthesize`. ~3× faster than v0.3's sequential play. |
| `flow-commit` | implementation | Conventional commit + sprint-status update |
| `flow-recall` | anytime | Pre-flight semantic check. **v0.8+** also ingests `.agents/memory/decisions.md` + `lessons.md` so ADR conflicts surface above sprint-corpus contradictions. |
| `flow-quick` | anytime | Bypass for small tasks (< 1 day) |
| `flow-course-correct` | anytime | Mid-sprint scope change (Minor / Moderate / Major) |
| `flow-retro` | end of epic | Party-mode retrospective. **v0.5+** then triggers `memory-condenser` to distill the closing epic into `.agents/memory/`. |
| `flow-auto` | batch | Bash orchestrator looping `/flow-story → /flow-dev → /flow-review → /flow-commit` over all sprint stories, fresh Pi session per story |

## Internal architecture (since v0.4)

`skills/flow/flow-internal/` holds **sub-agent prompt templates** — flat `.md` files, no SKILL.md frontmatter. Pi only resolves slash-commands at `skills/flow/<name>/SKILL.md` so these files are invisible to users and never appear in slash-command help.

| Sub-agent | Spawned by | Role |
|---|---|---|
| `research-corpus` | `flow-story` | Map repo files relevant to the upcoming story |
| `research-conventions` | `flow-story` | Surface conventions + tooling stack |
| `find-similar-impl` | `flow-dev` | Locate prior implementations to reuse |
| `check-dependencies` | `flow-dev` | Detect inter-story coupling + contract changes |
| `enumerate-tests` | `flow-dev` | Inventory tests covering the touched surface |
| `review-blind` | `flow-review` | Read the diff blind, hunt bugs/smells/naming |
| `review-edge-cases` | `flow-review` | Exhaustive paranoia over inputs and conditions |
| `review-acceptance` | `flow-review` | Verify each AC is actually satisfied (not coincidental green tests) |
| `synthesize` | every wave | Obligatory compression step after parallel outputs |
| `memory-condenser` | `flow-retro` | Distill an epic's artifacts into long-term memory diffs |

Sub-agents are spawned with `pi --print --no-session --append-system-prompt <prompt-file>`. They run in fresh ephemeral sessions, read-only on the repo, and emit short structured stdout (typically 300–500 words). The parent's companion `wave-*.sh` script captures their stdout into `.agents/internal/<id>/` and runs `synthesize` over them.

### Companion wave scripts

Each parent has a `wave-*.mjs` next to its `SKILL.md` (self-contained ESM bundles, ~7-10 KB each, with `#!/usr/bin/env node` shebang):

- `skills/flow/flow-story/wave-research.mjs` — corpus + conventions → synthesize
- `skills/flow/flow-dev/wave-dev.mjs` — similar-impl + dependencies + tests → synthesize
- `skills/flow/flow-review/wave-review.mjs` — blind + edge-cases + acceptance → synthesize
- `skills/flow/flow-retro/wave-memory.mjs` — memory condensation at epic closeout

Scripts spawn sub-processes via `child_process.spawn` and `Promise.all`, cap concurrency at the number of sub-agents (3 max so far), and never fail the parent if a sub-agent crashes — the parent falls back to a degraded inline path.

## Long-term memory (since v0.5)

`flow-retro` triggers `memory-condenser` over the closing epic. The sub-agent reads the epic + its stories + this retro + the existing memory, detects what is genuinely new vs already captured, and emits **5 append-only sections** that `wave-memory.sh` writes to:

| File | Append rule | Read by |
|---|---|---|
| `.agents/memory/overview.md` | Latest `## État actuel — <date>` block replaces previous (which is archived as `## État au <date>`) | `flow-help` cold-start |
| `.agents/memory/decisions.md` | ADR-style entries, **dedup by title** | `flow-recall` Layer 0 (highest priority) |
| `.agents/memory/lessons.md` | Bullets, **dedup by leading bold title** | `flow-recall` Layer 0 |
| `.agents/memory/journal.md` | One paragraph per epic, always appended | `flow-help` cold-start |
| `.agents/memory/glossary.md` | Domain terms, **dedup by term** | Human reader |

Memory is purely additive — `memory-condenser` never rewrites past entries. The condenser is read-only on memory; the wave script handles all writes with dedup.

### Cold-start in `flow-help`

When `.agents/memory/overview.md` exists and `git log -1` shows ≥30 days of inactivity, `flow-help` prefixes its 4-line State/Reco/Why/Output block with a Welcome-back panel: latest `État actuel` paraphrased, plus the journal tail (last 3 epics). This is the "I haven't touched this in 8 months" path.

## FLOW_PARALLEL — feature flag and fallback

Every wave honors the environment variable `FLOW_PARALLEL` (default `1`):

- `FLOW_PARALLEL=1` (default) — sub-agents spawn in parallel, synthesizer compacts, parent acts
- `FLOW_PARALLEL=0` — wave is skipped; parents fall back to their v0.3 inline behavior (single-thread exhaustive context gathering, sequential mental play of reviewers)

`flow-auto/run.sh` exports `FLOW_PARALLEL` so it propagates to every `pi --print` child. Use `FLOW_PARALLEL=0 bash run.sh` if Pi sub-process spawning is unavailable, for offline runs, or to A/B-compare wave vs inline behavior.

## Typical sequence

**Greenfield:**
`/flow-help` → `/flow-brainstorm` → `/flow-brief` → `/flow-prd` → `/flow-architecture` → `/flow-epics` → `/flow-sprint` → `/flow-story` (loop) → `/flow-retro`

**Brownfield:**
`/flow-help` → `/flow-introspect` → branch as needed.

**Cold restart (after months away):**
`/flow-help` — the Welcome-back block puts the context back in your hands in under 5 minutes.

**Anytime:** `/flow-help`, `/flow-status`, `/flow-recall`, `/flow-quick`, `/flow-course-correct`.

## flow-auto (batch mode)

Loops over all `ready-for-dev` stories in `sprint-status.yaml`, running each through the full CREATE → DEV → REVIEW → COMMIT cycle. Each step runs in a fresh Pi session (`pi --print --no-session`), equivalent to a `/clear` between stories.

```bash
~/.pi/agent/git/github.com/edouard-claude/pi-flow-skills/skills/flow/flow-auto/run.mjs
```

Path assumes install via `pi install git:github.com/edouard-claude/pi-flow-skills`. The `#!/usr/bin/env node` shebang dispatches to Node directly — no `bash`, no `node` keyword needed. If you want a short command, add this alias once to your shell profile:

```bash
alias flow-auto='~/.pi/agent/git/github.com/edouard-claude/pi-flow-skills/skills/flow/flow-auto/run.mjs'
```

Override defaults:
- `PI_MODE=text` — text output instead of streamed JSON events
- `PI_RAW=1` — raw JSON passthrough (debug)
- `PI_BIN=/path/to/pi` — alternate Pi binary
- `NO_COLOR=1` — disable ANSI colors
- `NO_STICKY_HEADER=1` — disable the sticky top header
- `FLOW_PARALLEL=0` — disable all parallel waves (v0.3-equivalent inline behavior)

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
│   ├── sprint-status.yaml      # development_status + dependencies (BMAD-style)
│   ├── stories/
│   │   └── story-XXX.md
│   └── retro-epic-XXX.md
├── memory/                     # long-term, populated by /flow-retro (v0.5+)
│   ├── overview.md
│   ├── decisions.md
│   ├── lessons.md
│   ├── journal.md
│   └── glossary.md
├── internal/                   # transient sub-agent inputs/outputs (v0.4+)
│   ├── <story-id>/             # pre-story wave (research-corpus, research-conventions, synthesis)
│   ├── <story-id>-dev/         # pre-dev wave (similar-impl, dependencies, tests, synthesis)
│   ├── <story-id>-review/      # review wave (blind, edge-cases, acceptance, synthesis)
│   └── <epic-id>-memory/       # condensation workspace
├── recall/
│   └── recall-<slug>-YYYY-MM-DD.md
└── project-context.md
```

`.agents/internal/` is safe to add to your `.gitignore` if you don't want sub-agent transient outputs tracked.

## Building from source (contributors only)

Users do not need this section — the published bundles are committed and run as-is. Only contributors editing TypeScript need:

```bash
npm install              # installs typescript, esbuild, yaml as devDependencies
npm run build            # bundles src/*.ts → skills/**/*.mjs
npm run typecheck        # strict tsc --noEmit
```

The bundles in `skills/flow/**/*.mjs` are **committed** so end users skip the build step entirely.

## Upgrading

- **v0.8.x → v0.9.0**: companion scripts migrated from `bash`/`python` to TypeScript bundles. End-user surface unchanged — slash-commands, sprint-status format, artifact layout, FLOW_PARALLEL flag, all identical. **Side effect**: requirements drop from `pi + bash + uv + jq` down to just `pi`. Existing aliases must change `bash <path>/run.sh` → `<path>/run.mjs` (drop the `bash`, swap the extension).
- **v0.3.x → v0.8.0**: no breaking change, no migration. New behaviors activate transparently. `.agents/memory/` is created lazily on the next `/flow-retro`. See [CHANGELOG.md](CHANGELOG.md).
- **v0.1.x → v0.2.0** (legacy breaking change): `sprint-status.yaml` switched to BMAD-compatible flat `development_status` format. Migrate with `~/.pi/agent/git/github.com/edouard-claude/pi-flow-skills/scripts/migrate-v0.2.py .agents/implementation/sprint-status.yaml`.

## Credits

Heavily inspired by [BMAD Method](https://docs.bmad-method.org) — same philosophy of phased, peer-collaborative workflows, adapted to Pi's skill primitives. The parent + parallel sub-agent pattern is informed by `pi-subagents` (nicobailon), `pi-crew` (baphuongna), and `pi-morph` (boofpackdev). The long-term memory layer is informed by `pi-hermes-memory` (chandra447) and the `docs/lessons.md` pattern of `pi-workflow-kit` (yinloo-ola).

## License

MIT — see [LICENSE](LICENSE).
