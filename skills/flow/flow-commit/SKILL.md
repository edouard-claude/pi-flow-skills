---
name: flow-commit
description: 'COMMIT phase of a story: builds a conventional-commits message (type(scope): description) from the story file
  and the diff, proposes it to the user, applies it, then updates sprint-status review -> done and identifies the next story.
  Use after /flow-review verdict approved.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-commit — clean commit + story closure

You produce a commit that summarizes what the story delivered, from the perspective of someone reading the git log 6 months from now. Neither too short, nor too verbose.

## When to use

- After `/flow-review` with an `approved` verdict
- To close a story in `review`

## Inputs (required)

- `.agents/implementation/stories/story-<id>.md` (title, AC, File List, Senior Review)
- Git diff staged or unstaged (`git status`, `git diff`)
- `.agents/implementation/sprint-status.yaml`

## Process

### Step 1 — Sanity checks

**Git pre-check**: if the folder is not a git repo (`git rev-parse --git-dir` fails), initialize it:
```bash
git init -b main
```
No error needed, this is expected for greenfield projects where the first commit comes from the agent.

**Then**:
- `git status`: confirm the files from the story's File List are indeed modified
- If unlisted files are modified: flag and ask (could be bug, could be missing File List entry). **Batch mode (`$FLOW_AUTO=1`)**: add them if they are clearly in the story's scope, otherwise write a note in Dev Notes and exit non-zero.
- If nothing to commit: stop, ask the user. **Batch mode**: exit non-zero with a clear message.

### Step 2 — Compose the message

**Conventional commits** format:
```
type(scope): short description (<= 72 chars)

[optional body: why, not what]

Closes story-<id>
```

Rules:
- **type**: `feat` (new feature), `fix` (bug), `refactor`, `chore`, `docs`, `test`, `perf`, `style`
- **scope**: affected module (e.g., `auth`, `api`, `worker`, `db`). Optional but recommended.
- **description**: imperative, lowercase, no trailing period
- **body**: why the change, what was learned, references (story, PR, issue). Not the what (the diff speaks).

### Step 3 — Validation (interactive mode)

Present the drafted message. Ask for explicit validation:
```
(a) Apply / (b) Edit / (c) Cancel
```

**Batch mode (`$FLOW_AUTO=1`)**: skip validation. Auto-apply directly (Step 4).

### Step 4 — Apply
- `git add` the files from the File List + `git commit -m "..."` (HEREDOC to preserve formatting)
- In interactive mode only: if `b`, iterate on the message; if `c`, stop without committing.

**Do NOT push** without an explicit user request — including in batch mode. `flow-auto` never pushes.

### Step 5 — Update sprint-status

- Story status: `review` → `done`
- `currentStory` → `null`
- Identify the **next ready story** (`ready-for-dev`, dependencies satisfied) and surface it in the output

### Step 6 — Epic completion check
If all stories of the epic are `done`:
- Note: "Epic <epic-id> complete."
- Suggest `/flow-retro`

## Output

- Commit applied in git
- sprint-status updated
- Announcement of the next story OR end of epic

## Next

- Next story → `/flow-story <next-id>` (in a new session if running `/flow-auto`)
- End of epic → `/flow-retro`
- End of full sprint → `/flow-help` to decide what's next

## Batch mode (`$FLOW_AUTO=1`)

- No (a)/(b)/(c) menu. Auto-apply the composed commit.
- No push (ever).
- Expected output: story `done` in sprint-status, exit 0.
- Nothing to commit or conflict → exit non-zero to stop the `flow-auto/run.sh` loop.
