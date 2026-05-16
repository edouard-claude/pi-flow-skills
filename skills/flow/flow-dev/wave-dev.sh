#!/usr/bin/env bash
# wave-dev.sh — pre-dev parallel research wave.
#
# Spawns three ephemeral Pi sub-agents in parallel against the story:
#   - find-similar-impl     (locate prior implementations to reuse)
#   - check-dependencies    (detect coupling with other stories)
#   - enumerate-tests       (inventory existing tests to preserve)
# then synthesizes their outputs into a single meta-prompt for the parent.
#
# Writes:
#   .agents/internal/<story-id>-dev/similar-impl.md
#   .agents/internal/<story-id>-dev/dependencies.md
#   .agents/internal/<story-id>-dev/tests.md
#   .agents/internal/<story-id>-dev/synthesis.md
#
# Feature flag: FLOW_PARALLEL=0 → skipped, parent falls through to v0.3 path.
#
# Usage:
#   bash <skill-dir>/wave-dev.sh <story-id>

set -euo pipefail

STORY_ID="${1:?usage: wave-dev.sh <story-id>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERNAL_DIR="$SCRIPT_DIR/../flow-internal"
STORY_PATH=".agents/implementation/stories/${STORY_ID}.md"
STATUS_PATH=".agents/implementation/sprint-status.yaml"
OUT_DIR=".agents/internal/${STORY_ID}-dev"
PI_BIN="${PI_BIN:-pi}"

if [ "${FLOW_PARALLEL:-1}" = "0" ]; then
  mkdir -p "$OUT_DIR"
  cat > "$OUT_DIR/synthesis.md" <<EOF
# Pre-dev synthesis — $STORY_ID (skipped)

\`FLOW_PARALLEL=0\` — pre-dev wave bypassed.
Parent proceeds with red-green-refactor directly from the story file.
EOF
  echo "wave-dev: skipped (FLOW_PARALLEL=0)"
  exit 0
fi

if ! command -v "$PI_BIN" >/dev/null 2>&1; then
  echo "ERROR: pi binary not found." >&2
  exit 1
fi

for f in find-similar-impl.md check-dependencies.md enumerate-tests.md synthesize.md; do
  if [ ! -f "$INTERNAL_DIR/$f" ]; then
    echo "ERROR: missing $INTERNAL_DIR/$f" >&2
    exit 1
  fi
done

if [ ! -f "$STORY_PATH" ]; then
  echo "ERROR: story file not found: $STORY_PATH" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# Extract Files to touch from the story.
TOUCHED_FILE="$OUT_DIR/_touched.txt"
awk '
  /^##[[:space:]]+Files to touch/ {flag=1; next}
  /^##[[:space:]]/ && flag {flag=0}
  flag && /^[[:space:]]*-[[:space:]]+(CREATE|UPDATE|DELETE):[[:space:]]*/ {
    sub(/^[[:space:]]*-[[:space:]]+(CREATE|UPDATE|DELETE):[[:space:]]*/, "")
    sub(/[[:space:]]+—.*/, "")
    sub(/[[:space:]]+-.*/, "")
    print
  }
' "$STORY_PATH" > "$TOUCHED_FILE"

TOUCHED_BLOCK="$(cat "$TOUCHED_FILE")"

# Distill IMPL_PATTERNS from the story's Implementation plan headers / verbs.
IMPL_PATTERNS_BLOCK="$(awk '
  /^##[[:space:]]+Implementation plan/ {flag=1; next}
  /^##[[:space:]]/ && flag {flag=0}
  flag && /^[[:space:]]*[0-9]+\./ {
    sub(/^[[:space:]]*[0-9]+\.[[:space:]]*/, "")
    print
  }
' "$STORY_PATH" | head -10)"

SIM_PROMPT="$(cat "$INTERNAL_DIR/find-similar-impl.md")"
DEPS_PROMPT="$(cat "$INTERNAL_DIR/check-dependencies.md")"
TESTS_PROMPT="$(cat "$INTERNAL_DIR/enumerate-tests.md")"
SYNTH_PROMPT="$(cat "$INTERNAL_DIR/synthesize.md")"

SIM_INPUT="STORY_ID: $STORY_ID
STORY_PATH: $STORY_PATH
IMPL_PATTERNS:
$IMPL_PATTERNS_BLOCK

Scan for prior art per your output schema."

DEPS_INPUT="STORY_ID: $STORY_ID
STORY_PATH: $STORY_PATH
STATUS_PATH: $STATUS_PATH
STORIES_DIR: .agents/implementation/stories/

Map coupling per your output schema."

TESTS_INPUT="STORY_ID: $STORY_ID
STORY_PATH: $STORY_PATH
TOUCHED_PATHS:
$TOUCHED_BLOCK

Inventory tests per your output schema."

echo "wave-dev: spawning similar-impl + dependencies + tests sub-agents in parallel..."

"$PI_BIN" --print --no-session \
    --append-system-prompt "$SIM_PROMPT" \
    "$SIM_INPUT" > "$OUT_DIR/similar-impl.md" 2> "$OUT_DIR/similar-impl.err" &
PID_SIM=$!

"$PI_BIN" --print --no-session \
    --append-system-prompt "$DEPS_PROMPT" \
    "$DEPS_INPUT" > "$OUT_DIR/dependencies.md" 2> "$OUT_DIR/dependencies.err" &
PID_DEPS=$!

"$PI_BIN" --print --no-session \
    --append-system-prompt "$TESTS_PROMPT" \
    "$TESTS_INPUT" > "$OUT_DIR/tests.md" 2> "$OUT_DIR/tests.err" &
PID_TESTS=$!

rc_sim=0; rc_deps=0; rc_tests=0
wait "$PID_SIM"   || rc_sim=$?
wait "$PID_DEPS"  || rc_deps=$?
wait "$PID_TESTS" || rc_tests=$?

for tuple in "similar-impl:$rc_sim" "dependencies:$rc_deps" "tests:$rc_tests"; do
  name="${tuple%:*}"; rc="${tuple#*:}"
  if [ "$rc" -ne 0 ]; then
    echo "WARN: $name sub-agent failed (rc=$rc). See $OUT_DIR/$name.err" >&2
    cat > "$OUT_DIR/$name.md" <<EOF
# $name — $STORY_ID (failed)

Sub-agent exited rc=$rc. Parent should proceed without this report.
EOF
  fi
done

SYNTH_INPUT="WAVE_KIND: pre-dev-research
STORY_ID: $STORY_ID

Read these three sub-agent reports and synthesize per your output schema.
Emphasis: surface concrete reuse opportunities and coupling risks the implementer
must acknowledge before the red-green-refactor loop.
- similar-impl: $OUT_DIR/similar-impl.md
- dependencies: $OUT_DIR/dependencies.md
- tests: $OUT_DIR/tests.md
"

echo "wave-dev: synthesizing..."
rc_synth=0
"$PI_BIN" --print --no-session \
    --append-system-prompt "$SYNTH_PROMPT" \
    "$SYNTH_INPUT" > "$OUT_DIR/synthesis.md" 2> "$OUT_DIR/synthesis.err" || rc_synth=$?

if [ "$rc_synth" -ne 0 ]; then
  echo "WARN: synthesize sub-agent failed (rc=$rc_synth)." >&2
  cat > "$OUT_DIR/synthesis.md" <<EOF
# Pre-dev synthesis — $STORY_ID (synthesizer failed)

Raw outputs:
- $OUT_DIR/similar-impl.md
- $OUT_DIR/dependencies.md
- $OUT_DIR/tests.md
EOF
fi

for f in "$OUT_DIR"/*.err; do
  [ -f "$f" ] && [ ! -s "$f" ] && rm -f "$f"
done

echo "wave-dev: done → $OUT_DIR/synthesis.md"
