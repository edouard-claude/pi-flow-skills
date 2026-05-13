---
name: flow-sprint
description: Generates or updates sprint-status.yaml in BMAD-compatible format (development_status as a flat key:status map, plus
  a dependencies cache for flow-auto). No free-form fields in the YAML — robust against accidental corruption. Use after /flow-epics
  or to refresh the sprint state machine.
version: 0.2.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-sprint — sprint state machine (BMAD-compatible)

You are a developer responsible for sprint tracking. Produces and maintains `sprint-status.yaml` in a **strict, minimal format**: every value is a fixed enum, never free text. This eliminates entire categories of YAML corruption bugs.

## When to use

- First time after `flow-epics` (sprint init)
- On the fly to detect new stories or refresh dependencies
- When `flow-help`, `flow-status`, or the user asks for a state refresh

## Inputs

- `.agents/planning/epics/*.md` (required — source of stories and dependencies)
- `.agents/implementation/sprint-status.yaml` if already exists (preserves statuses)
- `.agents/implementation/stories/*.md` (optional — detects already-created stories)

## Output format

```yaml
generated: 2026-MM-DD
last_updated: 2026-MM-DD
project: <sprint or project name>
story_location: .agents/implementation/stories

development_status:
  epic-001: in-progress
  story-001-01: done
  story-001-02: done
  story-001-03: ready-for-dev
  story-001-04: backlog
  story-001-05: backlog
  story-001-06: backlog
  epic-001-retrospective: optional

  epic-002: backlog
  story-002-01: backlog
  story-002-02: backlog
  ...
  epic-002-retrospective: optional

# Auto-generated from epic files. DO NOT edit manually — flow-sprint regenerates.
dependencies:
  story-001-02: [story-001-01]
  story-001-03: [story-001-01]
  story-002-01: [story-001-01]
  story-002-03: [story-002-01, story-002-02]
  ...
```

## Process

### First call (init)

1. **Parse every epic file** in `.agents/planning/epics/*.md` to extract:
   - Epic id (from frontmatter `epicId:` or filename)
   - Story ids (regex on `### story-NNN-MM` headers)
   - Story dependencies (look for `**Dependencies**:` or `**Depends on**:` lines, parse the comma-separated list)

2. **Build `development_status`** in epic order, then story order within each epic:
   - Add `epic-NNN: backlog`
   - Add each `story-NNN-MM: backlog`
   - Add `epic-NNN-retrospective: optional` at the end of each epic block

3. **Detect already-created stories**: for each `story-NNN-MM` whose file exists in `.agents/implementation/stories/`, set its status to at least `ready-for-dev`.

4. **Build `dependencies`** as a flat map `<story-id>: [<dep-id>, ...]`. Only include stories with at least one dep.

5. **Write the YAML** with the sections above, in this order: header keys (`generated`, `last_updated`, `project`, `story_location`), then `development_status`, then `dependencies` (with the warning comment).

### Subsequent calls (refresh)

1. **Preserve all existing statuses** in `development_status`. A `done` story never goes back.
2. **Add new entries** for any newly-introduced epic / story / story file.
3. **Regenerate `dependencies`** fully from the current epic files (this is the auto-managed section).
4. **Update `last_updated`** to current date.

## Strict rules

- **Status values are an enum**: `backlog | ready-for-dev | in-progress | review | done` (for stories) or `backlog | in-progress | done` (for epics) or `optional | done` (for retrospectives). Nothing else.
- **No free-form text in `development_status`**. No notes, no comments, no titles. Those live in epic files and story files.
- **`dependencies` is auto-managed**. Never edited by `flow-story` / `flow-dev` / `flow-review` / `flow-commit`. They only update `development_status[<id>]`.
- **Epic-block ordering**: epics are listed in numeric order (`epic-001` before `epic-002`). Stories within an epic in numeric order too.

## Notes & titles

These do NOT live in `sprint-status.yaml`. They belong:
- **Epic objective, value, stories overview** → `.agents/planning/epics/epic-NNN.md`
- **Story acceptance criteria, file list, dev notes, change log, senior review** → `.agents/implementation/stories/story-NNN-MM.md`

## Next

- Sprint init → `/flow-status` to verify the dashboard, then `/flow-story <next-id>` (or `/flow-auto`) to start
- Refresh → no mandatory next step
- All stories of an epic `done` → `/flow-retro` to mark `epic-NNN-retrospective: done`
