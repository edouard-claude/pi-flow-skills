#!/usr/bin/env bash
# flow-auto/run.sh — orchestrates the /flow-story → /flow-dev → /flow-review → /flow-commit
# loop over every ready-for-dev story in the sprint, restarting Pi with --no-session
# between each call (equivalent to /clear).
#
# Usage: bash ~/.pi/agent/git/github.com/edouard-claude/pi-flow-skills/skills/flow/flow-auto/run.sh [.agents/implementation/sprint-status.yaml]

set -euo pipefail

STATUS="${1:-.agents/implementation/sprint-status.yaml}"
PI_BIN="${PI_BIN:-pi}"

# Batch mode: the affected skills (flow-story, flow-dev, flow-commit) skip
# user gates (Wait for GO, menus, Apply/Edit/Cancel) because pi --print has
# no interactive stdin.
export FLOW_AUTO=1

# Stream Pi events for live visibility (instead of a silent screen).
# Override: PI_MODE=text for concatenated text output at the end.
PI_MODE="${PI_MODE:-json}"

if [ ! -f "$STATUS" ]; then
  echo "ERROR: sprint-status not found: $STATUS" >&2
  echo "Run /flow-sprint first." >&2
  exit 1
fi

if ! command -v "$PI_BIN" >/dev/null 2>&1; then
  echo "ERROR: pi binary not found. Set PI_BIN or install Pi." >&2
  exit 1
fi

if ! command -v uvx >/dev/null 2>&1; then
  echo "ERROR: uvx required to parse YAML. Install uv (https://docs.astral.sh/uv/)." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq required to format the Pi JSON stream." >&2
  echo "  macOS: brew install jq" >&2
  echo "  Linux: apt install jq  (or equivalent)" >&2
  echo "  bypass: PI_RAW=1 bash $0  (raw JSON output, no jq)" >&2
  if [ "${PI_RAW:-0}" != "1" ]; then
    exit 1
  fi
fi

# Pre-flight: flow-* skills must be loaded in Pi. We check on-disk presence
# (Pi discovers skill directories recursively).
SKILLS_ROOT="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/skills"
if ! find "$SKILLS_ROOT" -type d -name "flow-story" 2>/dev/null | grep -q .; then
  echo "ERROR: flow-* skills not found under $SKILLS_ROOT" >&2
  echo "Install the package:" >&2
  echo "  pi install git:github.com/edouard-claude/pi-flow-skills@v0.1.6" >&2
  exit 1
fi

# Pre-flight: run a minimal `pi --print` to catch broken extensions early.
# If any extension fails to load, Pi exits non-zero with "Failed to load extension"
# and the entire flow-auto loop would die mid-story (potentially after expensive
# work). Better to surface the issue up front with a clear pointer.
echo ">>> pre-flight: validating pi extensions..." >&2
preflight_out=$("$PI_BIN" --print --no-session -p "exit" 2>&1 || true)
if echo "$preflight_out" | grep -q "Failed to load extension"; then
  echo "ERROR: one or more pi extensions are broken. Output:" >&2
  echo "$preflight_out" | grep -E "Failed to load extension|^Error" >&2
  echo "" >&2
  echo "Fix options:" >&2
  echo "  - Edit the broken file in ~/.pi/agent/extensions/" >&2
  echo "  - Or disable it temporarily: mv <path>.ts <path>.ts.disabled" >&2
  echo "  - Then re-run this script." >&2
  exit 1
fi
echo ">>> pre-flight OK." >&2

next_story() {
  # Idempotency: prioritize a story already in progress (in-progress / review)
  # before starting a new one. Lets you restart run.sh after a crash.
  uvx --quiet --with pyyaml python3 - "$STATUS" <<'PY'
import sys, yaml
path = sys.argv[1]
with open(path) as f:
    data = yaml.safe_load(f)
stories = data.get("stories", [])
# Priority 1: story already in progress
for s in stories:
    if s.get("status") in ("in-progress", "review"):
        print(s["id"])
        sys.exit(0)
# Priority 2: next ready story with satisfied dependencies
done_ids = {s["id"] for s in stories if s.get("status") == "done"}
for s in stories:
    if s.get("status") not in ("backlog", "ready-for-dev"):
        continue
    deps = s.get("dependsOn", []) or []
    if all(d in done_ids for d in deps):
        print(s["id"])
        sys.exit(0)
sys.exit(0)
PY
}

story_status() {
  uvx --quiet --with pyyaml python3 - "$STATUS" "$1" <<'PY'
import sys, yaml
path, sid = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = yaml.safe_load(f)
for s in data.get("stories", []):
    if s["id"] == sid:
        print(s.get("status", "?"))
        sys.exit(0)
print("missing")
PY
}

# Fallback (option C): force a status transition in sprint-status.yaml if
# the LLM didn't update it after a phase. Explicit log when we intervene.
# Returns non-zero if the story is missing (corruption).
force_status() {
  local sid="$1"; local expected="$2"
  local current
  current=$(story_status "$sid")
  if [ "$current" = "$expected" ]; then
    return 0
  fi
  if [ "$current" = "missing" ]; then
    echo "ABORT: story '$sid' missing from $STATUS (broken YAML?)" >&2
    return 1
  fi
  echo "WARN: forcing status for $sid ($current → $expected, LLM didn't update)" >&2
  uvx --quiet --with pyyaml python3 - "$STATUS" "$sid" "$expected" <<'PY'
import sys, yaml
path, sid, new_status = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f:
    data = yaml.safe_load(f)
for s in data.get("stories", []):
    if s["id"] == sid:
        s["status"] = new_status
        break
if new_status == "done":
    if "sprint" in data and isinstance(data["sprint"], dict):
        if data["sprint"].get("currentStory") == sid:
            data["sprint"]["currentStory"] = None
with open(path, "w") as f:
    yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)
PY
}

# Batch system prompt: forbids any user pause, forces auto-action.
# Pattern borrowed from bmad_automated (Claude CLI + --dangerously-skip-permissions
# + prompts saying "do not ask clarifying questions").
read -r -d '' BATCH_PROMPT <<'EOF' || true
BATCH MODE ACTIVE. You have NO interactive stdin.

Rules:
1. Never ask the user for confirmation, validation, or a choice. No menus.
2. If a skill says "wait for GO", "present menu", "Continue/Revise/Pause",
   "(a) Apply / (b) Edit / (c) Cancel" — SKIP that gate, apply the default action,
   continue silently.
3. Use your best judgment. Do not seek clarification.
4. Auto-approve all internal tool calls (read, bash, edit, write).
5. If you genuinely lack the info to proceed (architecture ambiguity, missing
   dependency, test impossible to write), write the blocker into the relevant
   story file's Dev Notes section and exit with a clear error message.
6. The $FLOW_AUTO=1 env var means: this is gospel, not optional.
7. CRITICAL — sprint-status.yaml update. Before exiting, you MUST update
   .agents/implementation/sprint-status.yaml to reflect the new status of
   the story you just worked on. State machine (5 states):
     backlog → ready-for-dev → in-progress → review → done
   Transitions per skill:
     - flow-story   → status: ready-for-dev
     - flow-dev     → status: review (or stay in-progress if halt condition)
     - flow-review  → APPROVED: keep status: review, append "Senior Review"
                                section to the story file (do NOT mark done).
                      REWORK:   status: in-progress, add [AI-Review] items
                                (next flow-dev resumes the cycle).
     - flow-commit  → status: done, currentStory: null
   Preserve YAML indentation and structure exactly. Do NOT break the file.
   If you cannot determine the right transition, write a note in Dev Notes
   and exit with a non-zero error message — do not leave the YAML stale.

You are inside a bash loop that pipelines flow-story → flow-dev → flow-review →
flow-commit per story across the whole sprint. Each invocation must terminate
on its own (no infinite wait).
EOF

# jq formatter: transforms the Pi JSON event stream into readable live text.
# - thinking_delta / text_delta : chunk concatenation (raw output)
# - tool_use_start              : marker line [TOOL: name]
# - tool_use_complete           : marker line [/TOOL]
# - message_complete            : double newline to separate turns
# Bypass with PI_RAW=1 (useful to debug raw JSON).
read -r -d '' JQ_FORMAT <<'EOF' || true
. as $line |
(.assistantMessageEvent // {}) as $e |
if $e.type == "thinking_delta" then ($e.delta // "")
elif $e.type == "text_delta" then ($e.delta // "")
elif $e.type == "tool_use_start" then "\n\n[TOOL: " + (($e.name // $e.tool.name) // "?") + "]\n"
elif $e.type == "tool_use_complete" then "\n[/TOOL]\n"
elif (.type // "") == "message_complete" then "\n\n"
else empty
end
EOF

run_phase() {
  local phase="$1"; local story="$2"
  echo ">>> phase: $phase  story: $story  (session: ephemeral, mode: $PI_MODE)"
  local rc=0
  if [ "${PI_RAW:-0}" = "1" ]; then
    "$PI_BIN" --print --no-session --mode "$PI_MODE" \
         --append-system-prompt "$BATCH_PROMPT" \
         "/$phase $story" || rc=$?
  else
    "$PI_BIN" --print --no-session --mode "$PI_MODE" \
         --append-system-prompt "$BATCH_PROMPT" \
         "/$phase $story" \
       | jq --unbuffered -j "$JQ_FORMAT" || rc=$?
  fi
  if [ "$rc" -ne 0 ]; then
    echo "ERROR: /$phase $story failed (code $rc)" >&2
    return 1
  fi
}

total=0
while true; do
  STORY=$(next_story)
  if [ -z "$STORY" ]; then
    echo "No more stories to process. Done after $total stories."
    exit 0
  fi

  total=$((total + 1))
  initial=$(story_status "$STORY")
  echo ""
  echo "=========================================="
  echo "  STORY #$total: $STORY  (resuming from: $initial)"
  echo "=========================================="

  # Idempotency: each phase only runs if the current status warrants it.
  # Lets you restart run.sh after a crash and resume where you left off.

  # Phase 1 — CREATE: only if the story hasn't been prepared yet.
  if [ "$(story_status "$STORY")" = "backlog" ]; then
    run_phase "flow-story" "$STORY" || exit 1
    force_status "$STORY" "ready-for-dev" || exit 1
  fi

  # Phase 2 — DEV: if ready-for-dev or in-progress.
  case "$(story_status "$STORY")" in
    ready-for-dev|in-progress)
      run_phase "flow-dev" "$STORY" || exit 1
      status=$(story_status "$STORY")
      if [ "$status" = "ready-for-dev" ] || [ "$status" = "backlog" ]; then
        # LLM didn't even start dev — push to review so flow-review opens
        # an [AI-Review] item "dev not done".
        force_status "$STORY" "review" || exit 1
      fi
      ;;
  esac

  # Phase 3 — REVIEW: dev↔review loop until approved or max 3 cycles.
  # Skip if the story is already 'review' AND carries a "Senior Review"
  # section: that means review already happened and was approved — go
  # straight to commit.
  story_file=".agents/implementation/stories/${STORY}.md"
  needs_review=0
  case "$(story_status "$STORY")" in
    review)
      if [ -f "$story_file" ] && grep -qE "^#{1,3}[[:space:]]+Senior Review" "$story_file"; then
        echo "skip flow-review: Senior Review already present in $story_file"
      else
        needs_review=1
      fi
      ;;
    in-progress)
      needs_review=1
      ;;
  esac

  if [ "$needs_review" = "1" ]; then
    attempts=0
    while true; do
      attempts=$((attempts + 1))
      if [ "$attempts" -gt 3 ]; then
        echo "ABORT: too many dev/review cycles on $STORY ($attempts attempts)" >&2
        exit 1
      fi
      run_phase "flow-review" "$STORY" || exit 1
      status=$(story_status "$STORY")
      case "$status" in
        review)     break ;;  # APPROVED — go to commit
        in-progress)
          # REWORK — run flow-dev again to handle [AI-Review] items, then re-review.
          run_phase "flow-dev" "$STORY" || exit 1
          ;;
        *)
          echo "ABORT: unexpected status after flow-review: '$status'" >&2
          exit 1
          ;;
      esac
    done
  fi

  # Phase 4 — COMMIT: final transition review → done.
  if [ "$(story_status "$STORY")" = "review" ]; then
    run_phase "flow-commit" "$STORY" || exit 1
    force_status "$STORY" "done" || exit 1
  fi

  echo "OK: $STORY → done"
done
