#!/usr/bin/env bash
# wave-memory.sh — long-term memory condensation at end of epic.
#
# Spawns one ephemeral Pi sub-agent (memory-condenser) over the completed
# epic's artifacts, parses its sectioned output, appends each section to the
# corresponding file under .agents/memory/.
#
# Files maintained (created lazily on first run):
#   .agents/memory/overview.md   — macro state, replaces last "État actuel" block
#   .agents/memory/decisions.md  — ADR-style append-only
#   .agents/memory/lessons.md    — append-only
#   .agents/memory/journal.md    — append-only, one paragraph per epic
#   .agents/memory/glossary.md   — append-only with title-level dedup
#
# Feature flag: FLOW_PARALLEL=0 → skipped. Memory layer is purely additive,
# so skipping is safe — parent flow-retro continues normally.
#
# Usage:
#   bash <skill-dir>/wave-memory.sh <epic-id> <retro-path>

set -euo pipefail

EPIC_ID="${1:?usage: wave-memory.sh <epic-id> <retro-path>}"
RETRO_PATH="${2:?usage: wave-memory.sh <epic-id> <retro-path>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERNAL_DIR="$SCRIPT_DIR/../flow-internal"
MEMORY_DIR=".agents/memory"
WORK_DIR=".agents/internal/$EPIC_ID-memory"
PI_BIN="${PI_BIN:-pi}"

if [ "${FLOW_PARALLEL:-1}" = "0" ]; then
  echo "wave-memory: skipped (FLOW_PARALLEL=0)"
  exit 0
fi

if ! command -v "$PI_BIN" >/dev/null 2>&1; then
  echo "ERROR: pi binary not found." >&2
  exit 1
fi

if [ ! -f "$INTERNAL_DIR/memory-condenser.md" ]; then
  echo "ERROR: missing $INTERNAL_DIR/memory-condenser.md" >&2
  exit 1
fi

if [ ! -f "$RETRO_PATH" ]; then
  echo "ERROR: retro file not found: $RETRO_PATH" >&2
  exit 1
fi

mkdir -p "$MEMORY_DIR" "$WORK_DIR"

# Derive epic number (epic-002 → 002) for the stories glob.
EPIC_NUM="${EPIC_ID#epic-}"

EPIC_FILE="$(ls .agents/planning/epics/${EPIC_ID}*.md 2>/dev/null | head -1 || true)"
if [ -z "$EPIC_FILE" ]; then
  echo "ERROR: cannot find epic file for $EPIC_ID under .agents/planning/epics/" >&2
  exit 1
fi

TODAY="$(date +%Y-%m-%d)"

CONDENSER_PROMPT="$(cat "$INTERNAL_DIR/memory-condenser.md")"

TASK_INPUT="EPIC_ID: $EPIC_ID
EPIC_PATH: $EPIC_FILE
STORIES_DIR: .agents/implementation/stories/
STORIES_GLOB: story-${EPIC_NUM}-*.md
RETRO_PATH: $RETRO_PATH
MEMORY_DIR: $MEMORY_DIR
PRD_PATH: .agents/planning/prd.md
ARCH_PATH: .agents/planning/architecture.md
TODAY: $TODAY

Condense per your output schema. The wave script parses on '## SECTION: <name>' markers."

echo "wave-memory: condensing $EPIC_ID..."
rc=0
"$PI_BIN" --print --no-session \
    --append-system-prompt "$CONDENSER_PROMPT" \
    "$TASK_INPUT" > "$WORK_DIR/condensation.md" 2> "$WORK_DIR/condensation.err" || rc=$?

if [ "$rc" -ne 0 ]; then
  echo "WARN: memory-condenser failed (rc=$rc). See $WORK_DIR/condensation.err" >&2
  echo "wave-memory: aborted, memory unchanged."
  exit 0  # never fail the parent flow-retro
fi

# Parse the sectioned output and append/replace each section.
uvx --quiet --with pyyaml python3 - \
    "$WORK_DIR/condensation.md" "$MEMORY_DIR" "$EPIC_ID" "$TODAY" <<'PY'
import sys, re
from pathlib import Path

cond_path = Path(sys.argv[1])
mem_dir = Path(sys.argv[2])
epic_id = sys.argv[3]
today = sys.argv[4]

text = cond_path.read_text()

# Split on top-level "## SECTION: <name>" markers.
parts = re.split(r"^##\s+SECTION:\s+(\w+)\s*$", text, flags=re.MULTILINE)
# parts: [preamble, section_name, body, section_name, body, ...]
sections = {}
for i in range(1, len(parts), 2):
    name = parts[i].strip().lower()
    body = parts[i+1].strip() if i+1 < len(parts) else ""
    sections[name] = body

def write_if_missing(p: Path, header: str):
    if not p.exists():
        p.write_text(f"# {header}\n\n")

def append_block(p: Path, header: str, body: str, attribution: str):
    write_if_missing(p, header)
    current = p.read_text()
    block = f"\n## {today} — {epic_id} ({attribution})\n\n{body}\n"
    p.write_text(current + block)

def append_decisions(p: Path, body: str):
    """ADR entries: body already contains '### <date> — title' subsections."""
    write_if_missing(p, "Decisions (ADR-style)")
    current = p.read_text()
    # Dedup by title: skip any '### ... — <title>' already present.
    existing_titles = set(
        m.group(1).strip().lower()
        for m in re.finditer(r"^###\s+\S+\s+—\s+(.+)$", current, flags=re.MULTILINE)
    )
    new_entries = re.split(r"(?=^###\s)", body, flags=re.MULTILINE)
    kept = []
    for entry in new_entries:
        entry = entry.strip()
        if not entry:
            continue
        m = re.match(r"^###\s+\S+\s+—\s+(.+)$", entry, flags=re.MULTILINE)
        if m and m.group(1).strip().lower() in existing_titles:
            continue
        kept.append(entry)
    if kept:
        p.write_text(current + "\n" + "\n\n".join(kept) + "\n")

def append_lessons(p: Path, body: str):
    """Bullet list, dedup by leading bold title."""
    write_if_missing(p, "Lessons")
    current = p.read_text()
    existing = set(
        m.group(1).strip().lower()
        for m in re.finditer(r"^-\s+\*\*(.+?)\*\*", current, flags=re.MULTILINE)
    )
    bullets = re.findall(r"^-\s+\*\*(.+?)\*\*.*$", body, flags=re.MULTILINE)
    fresh_lines = []
    for line in body.splitlines():
        m = re.match(r"^-\s+\*\*(.+?)\*\*", line.strip())
        if m and m.group(1).strip().lower() in existing:
            continue
        fresh_lines.append(line)
    fresh = "\n".join(fresh_lines).strip()
    if fresh:
        p.write_text(current + f"\n## {today} — {epic_id}\n\n{fresh}\n")

def append_glossary(p: Path, body: str):
    write_if_missing(p, "Glossary")
    current = p.read_text()
    existing = set(
        m.group(1).strip().lower()
        for m in re.finditer(r"^-\s+\*\*(.+?)\*\*", current, flags=re.MULTILINE)
    )
    fresh_lines = []
    for line in body.splitlines():
        m = re.match(r"^-\s+\*\*(.+?)\*\*", line.strip())
        if not m:
            continue
        if m.group(1).strip().lower() in existing:
            continue
        fresh_lines.append(line)
    if fresh_lines:
        p.write_text(current + "\n" + "\n".join(fresh_lines) + "\n")

def replace_overview_current_state(p: Path, body: str):
    write_if_missing(p, "Overview")
    current = p.read_text()
    new_block = f"\n## État actuel — {today} (post-{epic_id})\n\n{body}\n"
    # Archive the previous "État actuel" by renaming its header to "État au ..."
    current = re.sub(
        r"^##\s+État actuel\s+—\s+(\S+)\s+\(post-\S+\)\s*$",
        r"## État au \1",
        current,
        flags=re.MULTILINE,
    )
    p.write_text(current + new_block)

changed = []

for key, fn, fname, attribution in [
    ("overview", replace_overview_current_state, "overview.md", None),
    ("decisions", append_decisions, "decisions.md", None),
    ("lessons", append_lessons, "lessons.md", None),
    ("glossary", append_glossary, "glossary.md", None),
]:
    body = sections.get(key, "").strip()
    if not body or body.lower() == "no change":
        continue
    fn(mem_dir / fname, body)
    changed.append(fname)

# Journal is always appended (never "no change") and uses standard attribution.
journal_body = sections.get("journal", "").strip()
if journal_body and journal_body.lower() != "no change":
    append_block(mem_dir / "journal.md", "Journal", journal_body, "closeout")
    changed.append("journal.md")

print(f"wave-memory: updated {len(changed)} file(s): {', '.join(changed) if changed else '(none)'}")
PY

# Clean up empty .err files.
for f in "$WORK_DIR"/*.err; do
  [ -f "$f" ] && [ ! -s "$f" ] && rm -f "$f"
done

echo "wave-memory: done → $MEMORY_DIR/"
