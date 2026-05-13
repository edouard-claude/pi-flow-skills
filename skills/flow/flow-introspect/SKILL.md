---
name: flow-introspect
description: 'Introspection of an existing project (brownfield): documents the actual state + produces an LLM-optimized project-context.md
  to feed subsequent flow agents. Use on any already-implemented project before /flow-prd or /flow-architecture, or when the
  user says ''document the project'', ''audit the state'', ''introspect''.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-introspect — state audit + project-context

Combines two BMAD goals: **document-project** (human-readable state) + **generate-project-context** (LLM-optimized rules).

## When to use

- Brownfield BEFORE any other flow phase
- Rewriting an existing project
- Picking up a project with a new agent / new developer

## Inputs

- The whole repo
- Optional: user briefing on which areas to dig into

## Process

### Phase 1 — Discovery (technical scan)

Inspect the repo:
- **Stack**: package.json / go.mod / requirements.txt / Cargo.toml
- **Structure**: root folders, module organization
- **Entry points**: main, index, hooks, app.ts
- **Conventions**: naming, organization, recurring patterns
- **Auth**: middleware, sessions, tokens, permission handling
- **DB**: ORM, migrations, schemas, RLS
- **Tests**: framework, organization, approximate coverage
- **Scripts**: npm scripts, Makefile, CI/CD
- **Key dependencies**: top 10 by criticality
- **Migrations / data**: schema, soft-deletes, multi-tenancy

### Phase 2 — Analysis (interpretation)

Spot:
- **Tech debt**: TODOs, FIXMEs, commented-out code, visible duplication
- **Implicit decisions**: undocumented conventions that need to be made explicit
- **Risks**: concurrent workers, plaintext secrets, missing RLS, outdated dependencies
- **Patterns to respect**: route structure, error handling, response format, etc.

### Phase 3 — Synthesis (2 deliverables)

#### `.agents/project-context.md` — LLM-optimized (~500-1500 tokens)

Lean, focused on the **non-obvious**. Short sections:
- Stack 1-liner
- Structure (root tree + commentary)
- Critical conventions (RLS, naming, error handling)
- Patterns to respect (API response format, auth, etc.)
- Common commands (dev, test, db, etc.)
- Pointers to real files — **NO** code copy-paste

To be loaded by any subsequent flow skill (story, dev, architecture rewrite).

#### `.agents/planning/current-state.md` — Human (readable)

- Current architecture (text or ASCII diagram)
- Main modules + responsibilities
- Critical workflows (auth, payment, etc.)
- Identified tech debt (prioritized)
- Implicit decisions to make explicit
- Risks + recommendations

## Next

Depending on need:
- New feature → `/flow-prd`
- Major refactor → `/flow-architecture`
- Small task → `/flow-quick` (can read project-context directly)
- Unsure → `/flow-help`
