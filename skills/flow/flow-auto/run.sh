#!/usr/bin/env bash
# flow-auto/run.sh — orchestrates the /flow-story → /flow-dev → /flow-review → /flow-commit
# loop over every ready-for-dev story in the sprint, restarting Pi with --no-session
# between each call (equivalent to /clear).
#
# Usage: bash ~/.pi/agent/git/github.com/edouard-claude/pi-flow-skills/skills/flow/flow-auto/run.sh [.agents/implementation/sprint-status.yaml]

set -euo pipefail

STATUS="${1:-.agents/implementation/sprint-status.yaml}"
PI_BIN="${PI_BIN:-pi}"

# ANSI colors. Disabled if NO_COLOR is set or stderr is not a TTY.
if [ -z "${NO_COLOR:-}" ] && [ -t 2 ]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_MAGENTA=$'\033[35m'
  C_CYAN=$'\033[36m'
  C_GRAY=$'\033[90m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""
  C_BLUE=""; C_MAGENTA=""; C_CYAN=""; C_GRAY=""
fi

# Batch mode: the affected skills (flow-story, flow-dev, flow-commit) skip
# user gates (Wait for GO, menus, Apply/Edit/Cancel) because pi --print has
# no interactive stdin.
export FLOW_AUTO=1

# Stream Pi events for live visibility (instead of a silent screen).
# Override: PI_MODE=text for concatenated text output at the end.
PI_MODE="${PI_MODE:-json}"

# Path to the companion markdown formatter (sits next to this script).
MD_FORMAT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/md-format.py"
if [ ! -x "$MD_FORMAT" ]; then
  # Fall back to a no-op (cat) if the formatter is missing or not executable.
  MD_FORMAT=$(command -v cat)
fi

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

# Pre-flight: flow-* skills must be loaded in Pi. We scan all known locations
# where Pi resolves skills: ~/.pi/agent/skills/ (manual install) and
# ~/.pi/agent/git/ (packages installed via `pi install git:...`).
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
if ! find "$PI_AGENT_DIR/skills" "$PI_AGENT_DIR/git" \
     -type d -name "flow-story" 2>/dev/null | grep -q .; then
  echo "ERROR: flow-* skills not found under $PI_AGENT_DIR" >&2
  echo "Install the package:" >&2
  echo "  pi install git:github.com/edouard-claude/pi-flow-skills@v0.2.4" >&2
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

# ────────────────────────────────────────────────────────────────────────────
# UI helpers — sticky header via ANSI scrolling region (DECSTBM)
# ────────────────────────────────────────────────────────────────────────────
#
# Mechanism:
#   1. Reserve the top HEADER_LINES rows for a fixed header (banner + dashboard)
#   2. Set scrolling region to lines [HEADER_LINES+1 .. bottom] via \033[N;Mr
#   3. All subsequent output (Pi stream) scrolls inside that region; the header
#      stays put.
#   4. Between stories, we redraw the header in-place (save/restore cursor).
#
# Disabled when:
#   - stderr is not a TTY (piped to file)
#   - NO_STICKY_HEADER env var is set
#   - terminal is too small (< 24 rows)

HEADER_LINES=12
STICKY=0
if [ -t 2 ] && [ -z "${NO_STICKY_HEADER:-}" ]; then
  TERM_HEIGHT=$(tput lines 2>/dev/null || echo 0)
  if [ "$TERM_HEIGHT" -ge 24 ]; then
    STICKY=1
  fi
fi

sticky_setup() {
  [ "$STICKY" = "1" ] || return 0
  # Clear screen, hide cursor briefly to avoid flicker
  printf "\033[2J\033[1;1H" >&2
}

sticky_lock_below_header() {
  [ "$STICKY" = "1" ] || return 0
  local h
  h=$(tput lines 2>/dev/null || echo 24)
  printf "\033[%d;%dr" $((HEADER_LINES + 1)) "$h" >&2
  printf "\033[%d;1H" $((HEADER_LINES + 1)) >&2
}

sticky_reset() {
  [ "$STICKY" = "1" ] || return 0
  printf "\033[r\033[?25h" >&2
}

# Render the entire header block (banner + compact dashboard) using ABSOLUTE
# cursor positioning so we never trigger scroll. Each of the HEADER_LINES
# rows is positioned with `\033[N;1H`, cleared with `\033[2K`, then printed.
# Pads with blank cleared rows if content < HEADER_LINES.
render_header_block_at_top() {
  uvx --quiet --with pyyaml python3 - "$STATUS" "$HEADER_LINES" \
    "$C_RESET" "$C_BOLD" "$C_DIM" "$C_GREEN" "$C_YELLOW" "$C_BLUE" "$C_GRAY" "$C_CYAN" \
    "$PI_BIN" "$PI_MODE" \
    <<'PY' >&2
import sys, yaml, re
status_path = sys.argv[1]
header_lines = int(sys.argv[2])
RESET, BOLD, DIM, GREEN, YELLOW, BLUE, GRAY, CYAN = sys.argv[3:11]
pi_bin, pi_mode = sys.argv[11], sys.argv[12]

with open(status_path) as f:
    data = yaml.safe_load(f)
ds = data.get("development_status", {}) or {}

STORY = re.compile(r"^story-(\d+)-(\d+)$")
EPIC = re.compile(r"^epic-(\d+)$")
stories = [(k, v) for k, v in ds.items() if STORY.match(k)]
total = len(stories)
done = sum(1 for _, s in stories if s == "done")
in_flight = sum(1 for _, s in stories if s in ("in-progress", "review"))
ready = sum(1 for _, s in stories if s == "ready-for-dev")
backlog = sum(1 for _, s in stories if s == "backlog")
pct = (done * 100 // total) if total else 0

width = 40
filled = (done * width) // total if total else 0
bar = GREEN + "█" * filled + GRAY + "░" * (width - filled) + RESET

current_epic = None
for k, v in ds.items():
    m = STORY.match(k)
    if m and v in ("in-progress", "review", "ready-for-dev"):
        current_epic = f"epic-{m.group(1).zfill(3)}"
        break
if current_epic is None:
    for k, v in ds.items():
        m = EPIC.match(k)
        if m and v != "done":
            current_epic = k
            break
if current_epic:
    epic_status = ds.get(current_epic, "?")
    epic_stories = [(k, v) for k, v in ds.items() if STORY.match(k) and f"epic-{STORY.match(k).group(1).zfill(3)}" == current_epic]
    e_done = sum(1 for _, s in epic_stories if s == "done")
    epic_line = f"{BOLD}Current epic{RESET}  {CYAN}{current_epic}{RESET}  {DIM}({epic_status} — {e_done}/{len(epic_stories)}){RESET}"
else:
    epic_line = ""

lines = [
    f"{BOLD}{CYAN}╭──────────────────────────────────────────────────────────╮{RESET}",
    f"{BOLD}{CYAN}│              flow-auto — sprint orchestrator             │{RESET}",
    f"{BOLD}{CYAN}╰──────────────────────────────────────────────────────────╯{RESET}",
    f"{DIM}  status: {status_path}{RESET}",
    f"{DIM}  pi: {pi_bin}  |  mode: {pi_mode}  |  FLOW_AUTO=1{RESET}",
    "",
    f"{BOLD}Progress{RESET} {bar} {BOLD}{pct}%{RESET} {DIM}({done}/{total}){RESET}",
    f"  {GREEN}● done {done}{RESET}  {YELLOW}● in-flight {in_flight}{RESET}  {BLUE}● ready {ready}{RESET}  {GRAY}● backlog {backlog}{RESET}",
    "",
    epic_line,
]
# Pad to exactly header_lines
while len(lines) < header_lines:
    lines.append("")
lines = lines[:header_lines]

# Emit each line at absolute position (row N, col 1), preceded by "clear line".
# No \n at all — strictly absolute positioning so we never trigger scroll.
out = []
for i, content in enumerate(lines, start=1):
    out.append(f"\033[{i};1H\033[2K{content}")
sys.stdout.write("".join(out))
sys.stdout.flush()
PY
}

# Refresh the header in place. Uses DECSC/DECRC (\0337/\0338) for cursor
# save/restore (more portable than \033[s/u SCOSC).
sticky_refresh_header() {
  if [ "$STICKY" != "1" ]; then
    print_banner
    print_dashboard_compact
    return
  fi
  printf "\0337" >&2                                      # DECSC save cursor
  printf "\033[r" >&2                                     # reset region
  render_header_block_at_top                              # paint header (absolute positioning)
  local h
  h=$(tput lines 2>/dev/null || echo 24)
  printf "\033[%d;%dr" $((HEADER_LINES + 1)) "$h" >&2     # re-arm region
  printf "\0338" >&2                                      # DECRC restore cursor
}

# Ensure we always restore the terminal on exit
trap sticky_reset EXIT INT TERM

print_banner() {
  echo "${C_BOLD}${C_CYAN}╭──────────────────────────────────────────────────────────╮${C_RESET}" >&2
  echo "${C_BOLD}${C_CYAN}│              flow-auto — sprint orchestrator             │${C_RESET}" >&2
  echo "${C_BOLD}${C_CYAN}╰──────────────────────────────────────────────────────────╯${C_RESET}" >&2
  echo "${C_DIM}  status: $STATUS${C_RESET}" >&2
  echo "${C_DIM}  pi: $PI_BIN  |  mode: $PI_MODE  |  FLOW_AUTO=1${C_RESET}" >&2
}

# Compact dashboard — fits within HEADER_LINES rows when combined with banner.
# No "Next actionable" list (that goes into the scrolling body before each story).
print_dashboard_compact() {
  uvx --quiet --with pyyaml python3 - "$STATUS" \
    "$C_RESET" "$C_BOLD" "$C_DIM" "$C_GREEN" "$C_YELLOW" "$C_BLUE" "$C_GRAY" "$C_CYAN" \
    <<'PY' >&2
import sys, yaml, re
path = sys.argv[1]
RESET, BOLD, DIM, GREEN, YELLOW, BLUE, GRAY, CYAN = sys.argv[2:10]
with open(path) as f:
    data = yaml.safe_load(f)
ds = data.get("development_status", {}) or {}

STORY = re.compile(r"^story-(\d+)-(\d+)$")
EPIC = re.compile(r"^epic-(\d+)$")

stories = [(k, v) for k, v in ds.items() if STORY.match(k)]
total = len(stories)
done = sum(1 for _, s in stories if s == "done")
in_flight = sum(1 for _, s in stories if s in ("in-progress", "review"))
ready = sum(1 for _, s in stories if s == "ready-for-dev")
backlog = sum(1 for _, s in stories if s == "backlog")
pct = (done * 100 // total) if total else 0

width = 40
filled = (done * width) // total if total else 0
bar = GREEN + "█" * filled + GRAY + "░" * (width - filled) + RESET

print(f"{BOLD}Progress{RESET} {bar} {BOLD}{pct}%{RESET} {DIM}({done}/{total}){RESET}")
print(f"  {GREEN}● done {done}{RESET}  {YELLOW}● in-flight {in_flight}{RESET}  {BLUE}● ready {ready}{RESET}  {GRAY}● backlog {backlog}{RESET}")

current_epic = None
for k, v in ds.items():
    m = STORY.match(k)
    if m and v in ("in-progress", "review", "ready-for-dev"):
        current_epic = f"epic-{m.group(1).zfill(3)}"
        break
if current_epic is None:
    for k, v in ds.items():
        m = EPIC.match(k)
        if m and v != "done":
            current_epic = k; break
if current_epic:
    epic_status = ds.get(current_epic, "?")
    epic_stories = [(k, v) for k, v in ds.items() if STORY.match(k) and f"epic-{STORY.match(k).group(1).zfill(3)}" == current_epic]
    e_done = sum(1 for _, s in epic_stories if s == "done")
    print(f"{BOLD}Current epic{RESET}  {CYAN}{current_epic}{RESET}  {DIM}({epic_status} — {e_done}/{len(epic_stories)}){RESET}")
PY
}

# Render a compact dashboard from sprint-status.yaml: progress bar, counts,
# current epic, next stories. Written to stderr so it doesn't pollute stdout.
print_dashboard() {
  uvx --quiet --with pyyaml python3 - "$STATUS" \
    "$C_RESET" "$C_BOLD" "$C_DIM" "$C_GREEN" "$C_YELLOW" "$C_BLUE" "$C_GRAY" "$C_CYAN" \
    <<'PY' >&2
import sys, yaml, re
path = sys.argv[1]
RESET, BOLD, DIM, GREEN, YELLOW, BLUE, GRAY, CYAN = sys.argv[2:10]
with open(path) as f:
    data = yaml.safe_load(f)
ds = data.get("development_status", {}) or {}
deps_map = data.get("dependencies", {}) or {}

STORY = re.compile(r"^story-(\d+)-(\d+)$")
EPIC = re.compile(r"^epic-(\d+)$")
EPIC_RETRO = re.compile(r"^epic-(\d+)-retrospective$")

stories = [(k, v) for k, v in ds.items() if STORY.match(k)]
total = len(stories)
done = sum(1 for _, s in stories if s == "done")
in_flight = sum(1 for _, s in stories if s in ("in-progress", "review"))
ready = sum(1 for _, s in stories if s == "ready-for-dev")
backlog = sum(1 for _, s in stories if s == "backlog")
pct = (done * 100 // total) if total else 0

# Progress bar
width = 40
filled = (done * width) // total if total else 0
bar = GREEN + "█" * filled + GRAY + "░" * (width - filled) + RESET

print(f"{BOLD}Progress{RESET}  {bar}  {BOLD}{pct}%{RESET}  {DIM}({done}/{total} stories){RESET}")
print(f"  {GREEN}● done {done}{RESET}  {YELLOW}● in-flight {in_flight}{RESET}  {BLUE}● ready {ready}{RESET}  {GRAY}● backlog {backlog}{RESET}")
print()

# Current epic (the one with an in-flight or ready story; otherwise the first non-done)
current_epic = None
for k, v in ds.items():
    m = STORY.match(k)
    if m and v in ("in-progress", "review", "ready-for-dev"):
        current_epic = f"epic-{m.group(1).zfill(3)}"
        break
if current_epic is None:
    for k, v in ds.items():
        m = EPIC.match(k)
        if m and v != "done":
            current_epic = k
            break

if current_epic:
    epic_status = ds.get(current_epic, "?")
    epic_stories = [(k, v) for k, v in ds.items() if STORY.match(k) and f"epic-{STORY.match(k).group(1).zfill(3)}" == current_epic]
    e_done = sum(1 for _, s in epic_stories if s == "done")
    e_total = len(epic_stories)
    print(f"{BOLD}Current epic{RESET}  {CYAN}{current_epic}{RESET}  {DIM}({epic_status} — {e_done}/{e_total} stories){RESET}")

# Next 5 actionable stories
done_ids = {k for k, v in stories if v == "done"}
def is_actionable(sid, status):
    if status in ("in-progress", "review", "ready-for-dev"):
        return True
    if status == "backlog":
        return all(d in done_ids for d in (deps_map.get(sid) or []))
    return False

actionable = [(k, v) for k, v in stories if is_actionable(k, v)][:5]
if actionable:
    print(f"{DIM}Next actionable:{RESET}")
    sym = {"done": (GREEN, "✓"), "in-progress": (YELLOW, "▶"), "review": (YELLOW, "▶"),
           "ready-for-dev": (BLUE, "◆"), "backlog": (GRAY, "○")}
    for sid, status in actionable:
        col, s = sym.get(status, (GRAY, "?"))
        print(f"  {col}{s}{RESET}  {sid}  {DIM}{status}{RESET}")
print()
PY
}

print_summary() {
  local stories_done="$1"
  local elapsed_s="$2"
  local mins=$((elapsed_s / 60))
  local secs=$((elapsed_s % 60))
  echo "" >&2
  echo "${C_BOLD}${C_GREEN}╭──────────────────────────────────────────────────────────╮${C_RESET}" >&2
  printf "${C_BOLD}${C_GREEN}│  ✓  %-52s│${C_RESET}\n" "Done — $stories_done stories processed in ${mins}m${secs}s" >&2
  echo "${C_BOLD}${C_GREEN}╰──────────────────────────────────────────────────────────╯${C_RESET}" >&2
}

start_time=$(date +%s)

# Initial render: banner + compact dashboard at top, then lock the scrolling
# region below it. If STICKY is disabled (non-TTY or small terminal), just
# print once and let everything flow normally.
if [ "$STICKY" = "1" ]; then
  sticky_setup                  # clear screen
  render_header_block_at_top    # paint banner+compact dashboard at absolute positions
  sticky_lock_below_header      # set scrolling region below header, move cursor in
  print_dashboard               # full dashboard (with "Next actionable") in scroll body
else
  print_banner
  print_dashboard
fi

next_story() {
  # BMAD-style sprint-status: 'development_status' is a flat key:status map;
  # 'dependencies' is auto-managed by flow-sprint. We iterate development_status
  # in declaration order (epic-by-epic), prioritizing in-progress/review (resume)
  # before fresh backlog/ready-for-dev (with satisfied deps).
  uvx --quiet --with pyyaml python3 - "$STATUS" <<'PY'
import sys, yaml, re
path = sys.argv[1]
with open(path) as f:
    data = yaml.safe_load(f)
ds = data.get("development_status", {}) or {}
deps_map = data.get("dependencies", {}) or {}

STORY = re.compile(r"^story-\d+-\d+$")

# Priority 1: a story already in flight
for sid, status in ds.items():
    if not STORY.match(sid):
        continue
    if status in ("in-progress", "review"):
        print(sid)
        sys.exit(0)

# Priority 2: next eligible (backlog / ready-for-dev with satisfied deps)
done_ids = {sid for sid, s in ds.items() if STORY.match(sid) and s == "done"}
for sid, status in ds.items():
    if not STORY.match(sid):
        continue
    if status not in ("backlog", "ready-for-dev"):
        continue
    deps = deps_map.get(sid) or []
    if all(d in done_ids for d in deps):
        print(sid)
        sys.exit(0)
PY
}

story_status() {
  uvx --quiet --with pyyaml python3 - "$STATUS" "$1" <<'PY'
import sys, yaml
path, sid = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = yaml.safe_load(f)
ds = data.get("development_status", {}) or {}
print(ds.get(sid, "missing"))
PY
}

# Fallback: force a status transition in sprint-status.yaml when the LLM
# fails to update development_status[<id>] itself. Logs the override.
force_status() {
  local sid="$1"; local expected="$2"
  local current
  current=$(story_status "$sid")
  if [ "$current" = "$expected" ]; then
    return 0
  fi
  if [ "$current" = "missing" ]; then
    echo "ABORT: story '$sid' missing from development_status in $STATUS (broken YAML or not in sprint)?" >&2
    return 1
  fi
  echo "WARN: forcing status for $sid ($current -> $expected, LLM didn't update)" >&2
  uvx --quiet --with pyyaml python3 - "$STATUS" "$sid" "$expected" <<'PY'
import sys, yaml
from pathlib import Path
path, sid, new_status = sys.argv[1], sys.argv[2], sys.argv[3]
text = Path(path).read_text()
# Patch only the matching `<sid>: <old>` line, leave structure pristine.
import re
new_text, n = re.subn(
    rf"^(\s*{re.escape(sid)}:\s*)\S+\s*$",
    lambda m: m.group(1) + new_status,
    text,
    count=1,
    flags=re.MULTILINE,
)
if n == 0:
    print(f"ERROR: regex did not match '{sid}:' in {path}", file=sys.stderr)
    sys.exit(1)
Path(path).write_text(new_text)
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
7. CRITICAL — sprint-status.yaml update. The file has TWO blocks:
     development_status: { <id>: <status>, ... }   <- EDIT ONLY THIS LINE
     dependencies:       { ... }                   <- NEVER touch (auto-managed)
   You MUST edit ONE line: `development_status[<story-id>]: <new-status>`.
   Nothing else. No new keys, no comments, no free text.
   State machine (5 states): backlog -> ready-for-dev -> in-progress -> review -> done.
   Transitions per skill:
     - flow-story   -> set status to: ready-for-dev
     - flow-dev     -> set status to: review (or leave in-progress on halt)
     - flow-review  -> APPROVED: do NOT change status (keep review), append a
                                 "## Senior Review" section to the story file.
                       REWORK:   set status to: in-progress, add [AI-Review]
                                 items at the bottom of the story file.
     - flow-commit  -> set status to: done. If all stories of the epic are
                       done, also flip development_status[epic-NNN]: done.
   All free-form text (decisions, dev notes, review findings, file lists)
   belongs in the markdown story file, NEVER in sprint-status.yaml.
   If you can't determine the right transition, write a note in the story
   file's Dev Notes and exit non-zero — do not leave the YAML inconsistent.

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
  echo "${C_BLUE}▶ phase:${C_RESET} ${C_BOLD}$phase${C_RESET}  ${C_DIM}story: $story  (ephemeral, mode: $PI_MODE)${C_RESET}" >&2
  local rc=0
  if [ "${PI_RAW:-0}" = "1" ]; then
    "$PI_BIN" --print --no-session --mode "$PI_MODE" \
         --append-system-prompt "$BATCH_PROMPT" \
         "/$phase $story" || rc=$?
  else
    # Pipe: pi events → jq formatter → markdown beautifier → terminal.
    # set -o pipefail propagates the first non-zero exit so pi failures abort.
    "$PI_BIN" --print --no-session --mode "$PI_MODE" \
         --append-system-prompt "$BATCH_PROMPT" \
         "/$phase $story" \
       | jq --unbuffered -j "$JQ_FORMAT" \
       | "$MD_FORMAT" || rc=$?
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
    elapsed=$(( $(date +%s) - start_time ))
    sticky_reset
    print_summary "$total" "$elapsed"
    exit 0
  fi

  total=$((total + 1))
  initial=$(story_status "$STORY")
  echo "" >&2
  echo "${C_BOLD}${C_MAGENTA}━━━ STORY #$total ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}" >&2
  echo "${C_BOLD}  $STORY${C_RESET}  ${C_DIM}(entering from: $initial)${C_RESET}" >&2
  echo "${C_MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}" >&2

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

  echo "${C_GREEN}${C_BOLD}✓ ${STORY}${C_RESET}${C_DIM} → done${C_RESET}" >&2
  # Refresh the sticky header (progress, counts, current epic) without
  # disturbing the scrolled output. In non-sticky mode, fall back to a
  # full dashboard print in the flow.
  sticky_refresh_header
done

elapsed=$(( $(date +%s) - start_time ))
print_summary "$total" "$elapsed"
