#!/usr/bin/env bash
# wave-review.sh — parallel adversarial review.
#
# Spawns three ephemeral Pi sub-agents (blind, edge-cases, acceptance) in
# parallel against the story's diff, then synthesizes their findings.
#
# Writes:
#   .agents/internal/<story-id>-review/blind.md
#   .agents/internal/<story-id>-review/edge-cases.md
#   .agents/internal/<story-id>-review/acceptance.md
#   .agents/internal/<story-id>-review/synthesis.md
#
# Feature flag: FLOW_PARALLEL=0 → wave skipped, synthesis.md flagged "skipped".
#
# Usage:
#   bash <skill-dir>/wave-review.sh <story-id>

set -euo pipefail

STORY_ID="${1:?usage: wave-review.sh <story-id>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERNAL_DIR="$SCRIPT_DIR/../flow-internal"
STORY_PATH=".agents/implementation/stories/${STORY_ID}.md"
OUT_DIR=".agents/internal/${STORY_ID}-review"
PI_BIN="${PI_BIN:-pi}"

if [ "${FLOW_PARALLEL:-1}" = "0" ]; then
  mkdir -p "$OUT_DIR"
  cat > "$OUT_DIR/synthesis.md" <<EOF
# Review synthesis — $STORY_ID (skipped)

\`FLOW_PARALLEL=0\` — parallel review wave bypassed.
Parent should perform the three review angles inline as in v0.3.
EOF
  echo "wave-review: skipped (FLOW_PARALLEL=0)"
  exit 0
fi

if ! command -v "$PI_BIN" >/dev/null 2>&1; then
  echo "ERROR: pi binary not found." >&2
  exit 1
fi

for f in review-blind.md review-edge-cases.md review-acceptance.md synthesize.md; do
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

# Extract DIFF_PATHS from the story's File List section.
DIFF_PATHS_FILE="$OUT_DIR/_diff-paths.txt"
awk '
  /^##[[:space:]]+File [Ll]ist/ {flag=1; next}
  /^##[[:space:]]/ && flag {flag=0}
  flag && /^[[:space:]]*-[[:space:]]+(CREATE|UPDATE|DELETE):[[:space:]]*/ {
    sub(/^[[:space:]]*-[[:space:]]+(CREATE|UPDATE|DELETE):[[:space:]]*/, "")
    sub(/[[:space:]]+—.*/, "")
    sub(/[[:space:]]+-.*/, "")
    print
  }
' "$STORY_PATH" > "$DIFF_PATHS_FILE"

if [ ! -s "$DIFF_PATHS_FILE" ]; then
  # Fallback: use git diff names from the last commit + working tree.
  (git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null) \
    | sort -u > "$DIFF_PATHS_FILE" || true
fi

BLIND_PROMPT="$(cat "$INTERNAL_DIR/review-blind.md")"
EDGE_PROMPT="$(cat "$INTERNAL_DIR/review-edge-cases.md")"
ACC_PROMPT="$(cat "$INTERNAL_DIR/review-acceptance.md")"
SYNTH_PROMPT="$(cat "$INTERNAL_DIR/synthesize.md")"

DIFF_PATHS_BLOCK="$(cat "$DIFF_PATHS_FILE")"

BLIND_INPUT="STORY_ID: $STORY_ID
DIFF_PATHS:
$DIFF_PATHS_BLOCK

Run git diff against these paths and review per your output schema."

SHARED_INPUT="STORY_ID: $STORY_ID
STORY_PATH: $STORY_PATH
DIFF_PATHS:
$DIFF_PATHS_BLOCK

Read the story file and the diff, then review per your output schema."

echo "wave-review: spawning blind + edge-cases + acceptance reviewers in parallel..."

"$PI_BIN" --print --no-session \
    --append-system-prompt "$BLIND_PROMPT" \
    "$BLIND_INPUT" > "$OUT_DIR/blind.md" 2> "$OUT_DIR/blind.err" &
PID_BLIND=$!

"$PI_BIN" --print --no-session \
    --append-system-prompt "$EDGE_PROMPT" \
    "$SHARED_INPUT" > "$OUT_DIR/edge-cases.md" 2> "$OUT_DIR/edge-cases.err" &
PID_EDGE=$!

"$PI_BIN" --print --no-session \
    --append-system-prompt "$ACC_PROMPT" \
    "$SHARED_INPUT" > "$OUT_DIR/acceptance.md" 2> "$OUT_DIR/acceptance.err" &
PID_ACC=$!

rc_blind=0; rc_edge=0; rc_acc=0
wait "$PID_BLIND" || rc_blind=$?
wait "$PID_EDGE"  || rc_edge=$?
wait "$PID_ACC"   || rc_acc=$?

for tuple in "blind:$rc_blind" "edge-cases:$rc_edge" "acceptance:$rc_acc"; do
  name="${tuple%:*}"; rc="${tuple#*:}"
  if [ "$rc" -ne 0 ]; then
    echo "WARN: $name reviewer failed (rc=$rc). See $OUT_DIR/$name.err" >&2
    cat > "$OUT_DIR/$name.md" <<EOF
# $name review — $STORY_ID (failed)

Sub-agent exited rc=$rc. Parent should perform this angle inline.
EOF
  fi
done

SYNTH_INPUT="WAVE_KIND: parallel-review
STORY_ID: $STORY_ID

Read these three reviewer outputs and synthesize per your output schema.
Pay special attention to severity escalation: if any reviewer flagged a blocker,
the synthesis must surface it under Contradictions (if disputed) or directly in
the TL;DR / Files-to-touch list.
- blind: $OUT_DIR/blind.md
- edge-cases: $OUT_DIR/edge-cases.md
- acceptance: $OUT_DIR/acceptance.md
"

echo "wave-review: synthesizing..."
rc_synth=0
"$PI_BIN" --print --no-session \
    --append-system-prompt "$SYNTH_PROMPT" \
    "$SYNTH_INPUT" > "$OUT_DIR/synthesis.md" 2> "$OUT_DIR/synthesis.err" || rc_synth=$?

if [ "$rc_synth" -ne 0 ]; then
  echo "WARN: review synthesizer failed (rc=$rc_synth)." >&2
  cat > "$OUT_DIR/synthesis.md" <<EOF
# Review synthesis — $STORY_ID (synthesizer failed)

Synthesizer sub-agent failed. Raw outputs available at:
- $OUT_DIR/blind.md
- $OUT_DIR/edge-cases.md
- $OUT_DIR/acceptance.md

Parent should read them directly and triage per the original flow-review rules.
EOF
fi

for f in "$OUT_DIR"/*.err; do
  [ -f "$f" ] && [ ! -s "$f" ] && rm -f "$f"
done

echo "wave-review: done → $OUT_DIR/synthesis.md"
