# Changelog

All notable changes to this project will be documented here. The format is loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.9.0] — 2026-05-16

**Theme**: full TypeScript migration. Companion scripts converted from `bash + python + uvx + jq` to self-contained Node ESM bundles. End-user surface unchanged.

### Why

The previous architecture required users to install `bash ≥3.2`, `uv` (for `uvx`-driven PyYAML), and `jq` on top of Pi. Since Pi already bundles Node, those three tools are pure overhead. v0.9.0 collapses all companion scripts onto Node and ships them as `.mjs` bundles committed in the repo. Users now need only `pi`. Cross-platform support widens (Windows native, no Git Bash needed).

### Changed (no user-facing surface change)

- `skills/flow/flow-auto/run.mjs` replaces `run.sh` + `md-format.py`. Self-contained ESM, ~287 KB (includes `yaml` and the JSON event parser previously delegated to `jq`).
- `skills/flow/flow-story/wave-research.mjs` replaces `wave-research.sh`
- `skills/flow/flow-dev/wave-dev.mjs` replaces `wave-dev.sh`
- `skills/flow/flow-review/wave-review.mjs` replaces `wave-review.sh`
- `skills/flow/flow-retro/wave-memory.mjs` replaces `wave-memory.sh`
- All 5 bundles have a `#!/usr/bin/env node` shebang and are committed executable — invocation is now `<path>/script.mjs <args>` (no `bash`, no `node` keyword).
- SKILL.md of `flow-story`, `flow-dev`, `flow-review`, `flow-retro`, `flow-auto` updated to reference `.mjs` paths.
- README requirements section reduced to a single line: `pi`. No more `bash`/`uvx`/`jq` install instructions.

### Added (contributor-facing)

- `src/lib/{ansi,sprint-status,pi-runner,markdown,wave,git}.ts` — shared TypeScript modules
- `src/flow-auto.ts`, `src/wave-*.ts` — entry points
- `package.json` declares devDependencies: `typescript`, `esbuild`, `@types/node`, `yaml`
- `tsconfig.json` — strict mode (`strict: true`, `strictNullChecks`, `noImplicitAny`, `noUnusedLocals`)
- `build.mjs` — esbuild bundler script (`npm run build`)
- `npm run typecheck` — `tsc --noEmit`
- Bundles are deterministic ESM, bundle yaml inline, target node18+.

### Removed

- `skills/flow/flow-auto/run.sh` (kept in git history)
- `skills/flow/flow-auto/md-format.py`
- `skills/flow/flow-story/wave-research.sh`
- `skills/flow/flow-dev/wave-dev.sh`
- `skills/flow/flow-review/wave-review.sh`
- `skills/flow/flow-retro/wave-memory.sh`

### Migration

For end users:
- Re-run `pi install git:github.com/edouard-claude/pi-flow-skills@v0.9.0`
- If you had an alias `alias flow-auto='bash ~/.pi/.../run.sh'`, change to `alias flow-auto='~/.pi/.../run.mjs'` (drop the `bash`, swap the extension)
- No changes to `.agents/` artifact layout, `sprint-status.yaml` format, or slash-command behavior

For contributors:
- Edit `src/*.ts` then run `npm run build` before committing
- The `.mjs` bundles in `skills/**/*.mjs` are part of the source of truth (committed)

## [0.8.0] — 2026-05-16

**Theme**: parent-orchestrator architecture with parallel ephemeral Pi sub-agents + long-term memory layer.

### Surface stays identical

All 18 public slash-commands keep their names, arguments, and external behavior. **No breaking change.** Existing projects continue to work without migration. The new behaviors activate transparently on the next invocation.

### Architectural shift

Three implementation skills (`flow-story`, `flow-dev`, `flow-review`) and one closeout skill (`flow-retro`) become **parent orchestrators**: each spawns multiple ephemeral Pi sub-processes (`pi --print --no-session --append-system-prompt`) in parallel against the repo, then runs an obligatory `synthesize` pass over their outputs. Sub-agent prompt templates live in a new internal directory `skills/flow/flow-internal/` (invisible to slash-command resolution because they are flat `.md` files, not `<name>/SKILL.md`).

### Added

- `skills/flow/flow-internal/` — 7 sub-agent prompt templates:
  - `research-corpus.md` — locate repo files relevant to the upcoming story
  - `research-conventions.md` — surface conventions + tooling stack affecting the story
  - `synthesize.md` — compress parallel outputs into one meta-prompt
  - `find-similar-impl.md` — locate prior implementations to reuse
  - `check-dependencies.md` — detect inter-story coupling and contract changes
  - `enumerate-tests.md` — inventory tests covering the touched surface
  - `memory-condenser.md` — distill an epic's artifacts into long-term memory diffs
- `skills/flow/flow-story/wave-research.sh` — pre-story parallel wave (corpus + conventions → synthesize)
- `skills/flow/flow-dev/wave-dev.sh` — pre-dev parallel wave (similar-impl + dependencies + tests → synthesize)
- `skills/flow/flow-review/wave-review.sh` — adversarial review wave (blind + edge-cases + acceptance → synthesize)
- `skills/flow/flow-retro/wave-memory.sh` — epic closeout memory condensation
- `skills/flow/flow-internal/review-{blind,edge-cases,acceptance}.md` — 3 reviewer roles, fresh-context
- `.agents/memory/` (lazy) — long-term memory layer maintained by `flow-retro`:
  - `overview.md` — macro state (latest "État actuel" block replaces previous, archived as "État au …")
  - `decisions.md` — ADR-style entries, dedup by title
  - `lessons.md` — recurring patterns, dedup by leading bold title
  - `journal.md` — one paragraph per epic, always appended
  - `glossary.md` — domain vocabulary, dedup by term
- `.agents/internal/<id>/` (transient) — sub-agent inputs and outputs, may be cleaned periodically
- Environment variable `FLOW_PARALLEL` (default `1`) — see Fallback below

### Changed

- `flow-story` v0.4.0 — adds Step 0 (pre-research wave) producing `synthesis.md`; downstream steps lean on it before falling back to the v0.3 exhaustive sweep
- `flow-dev` v0.7.0 — adds Step 3 (pre-dev wave) so red-green-refactor starts with a reuse map, coupling map, and test inventory
- `flow-review` v0.6.0 — three reviewers now run in parallel ephemeral Pi sessions (≈3× wall-time gain on this phase); parent does triage + writes Senior Review or [AI-Review] items
- `flow-retro` v0.5.0 — adds Step 11b: triggers `memory-condenser` over the closing epic
- `flow-help` v0.5.0 — adds Step 0 cold-start detection; when `git log` shows ≥30 days inactivity and `.agents/memory/` exists, output is prefixed with a Welcome-back block citing the latest overview and journal tail
- `flow-recall` v0.8.0 — adds Layer 0 ingestion of `.agents/memory/{decisions,lessons}.md`; ADR conflicts surface above sprint-corpus contradictions
- `flow-auto/run.sh` — exports `FLOW_PARALLEL` to sub-processes; header banner shows the active flag value

### Fallback

Set `FLOW_PARALLEL=0` to disable every wave:
- `flow-story` reverts to v0.3 exhaustive context gathering
- `flow-dev` skips pre-dev wave, red-green-refactor runs directly off the story file
- `flow-review` plays the three reviewers inline (sequential, in-context) as in v0.3
- `flow-retro` skips memory condensation (memory layer is purely additive — safe to skip)
- All slash-command outputs remain identical in shape

Use this if Pi sub-processes are unavailable, for offline runs, or to A/B-compare with the v0.3 behavior.

### Dependencies

No new runtime dependencies. Still: `pi`, `bash` ≥ 3.2, `uv`/`uvx`, `jq`.

### Migration notes

- **No action required** for projects already on v0.3.x.
- `.agents/memory/` is created lazily on the first `/flow-retro` after upgrading. Existing retros are not back-condensed; only future retros populate memory.
- Sub-agent transient outputs in `.agents/internal/` are safe to add to `.gitignore` if you don't want them tracked.
- The `FLOW_PARALLEL=0` fallback is a stable contract — keep it documented for users who hit Pi sub-process limits.

## [0.3.0] — 2026-05-13

- `flow-recall` skill: pre-flight semantic check on the frozen corpus
- Story tags (`storyId`, `epic`, `status`, `size`) in YAML frontmatter

## [0.2.4] — earlier

- `run.sh` sticky-header fixes
- Lightweight markdown beautifier in the run.sh event pipeline
- BMAD-compatible `sprint-status.yaml` format (flat `development_status` map, `dependencies` block)
- Friendlier `flow-auto/run.sh` UX (banner, dashboard, progress bar, colors)

## [0.1.x] — initial

- 18 BMAD-inspired skills (brainstorm → commit)
- `flow-auto` bash orchestrator with `--no-session` per-story isolation
