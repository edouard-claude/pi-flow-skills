#!/usr/bin/env bash
# wave-research.sh — pre-story parallel research wave.
#
# Spawns two ephemeral Pi sub-processes (corpus + conventions) in parallel,
# then runs a synthesizer over their outputs. Writes:
#   .agents/internal/<story-id>/corpus.md
#   .agents/internal/<story-id>/conventions.md
#   .agents/internal/<story-id>/synthesis.md
#
# Parent prerequisite: write .agents/internal/<story-id>/_input.md FIRST
# (STORY_ID, STORY_TITLE, STORY_SUMMARY, EPIC_PATH, ARCH_PATH).
#
# Feature flag: FLOW_PARALLEL=0 → wave skipped, synthesis.md flagged "skipped".
#
# Usage:
#   bash <skill-dir>/wave-research.sh <story-id>

set -euo pipefail

STORY_ID="${1:?usage: wave-research.sh <story-id>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERNAL_DIR="$SCRIPT_DIR/../flow-internal"
OUT_DIR=".agents/internal/$STORY_ID"
INPUT_FILE="$OUT_DIR/_input.md"
PI_BIN="${PI_BIN:-pi}"

# v0.3 fallback path. flow-story SKILL.md falls through to its classic
# context-gathering Steps 2-4 when this file says "skipped".
if [ "${FLOW_PARALLEL:-1}" = "0" ]; then
  mkdir -p "$OUT_DIR"
  cat > "$OUT_DIR/synthesis.md" <<EOF
# Wave synthesis — $STORY_ID (skipped)

\`FLOW_PARALLEL=0\` — pre-research wave bypassed.
Parent should proceed with its classic exhaustive context-gathering steps.
EOF
  echo "wave-research: skipped (FLOW_PARALLEL=0)"
  exit 0
fi

if ! command -v "$PI_BIN" >/dev/null 2>&1; then
  echo "ERROR: pi binary not found. Set PI_BIN or install Pi." >&2
  exit 1
fi

for f in research-corpus.md research-conventions.md synthesize.md; do
  if [ ! -f "$INTERNAL_DIR/$f" ]; then
    echo "ERROR: missing sub-agent template $INTERNAL_DIR/$f" >&2
    exit 1
  fi
done

if [ ! -f "$INPUT_FILE" ]; then
  echo "ERROR: $INPUT_FILE not found." >&2
  echo "  The parent must write STORY_ID/TITLE/SUMMARY/EPIC_PATH/ARCH_PATH there first." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

CORPUS_PROMPT="$(cat "$INTERNAL_DIR/research-corpus.md")"
CONV_PROMPT="$(cat "$INTERNAL_DIR/research-conventions.md")"
SYNTH_PROMPT="$(cat "$INTERNAL_DIR/synthesize.md")"
TASK_INPUT="$(cat "$INPUT_FILE")"

echo "wave-research: spawning corpus + conventions sub-agents in parallel..."

"$PI_BIN" --print --no-session \
    --append-system-prompt "$CORPUS_PROMPT" \
    "$TASK_INPUT" > "$OUT_DIR/corpus.md" 2> "$OUT_DIR/corpus.err" &
PID_CORPUS=$!

"$PI_BIN" --print --no-session \
    --append-system-prompt "$CONV_PROMPT" \
    "$TASK_INPUT" > "$OUT_DIR/conventions.md" 2> "$OUT_DIR/conventions.err" &
PID_CONV=$!

rc_corpus=0
rc_conv=0
wait "$PID_CORPUS" || rc_corpus=$?
wait "$PID_CONV" || rc_conv=$?

if [ "$rc_corpus" -ne 0 ]; then
  echo "WARN: corpus sub-agent failed (rc=$rc_corpus). See $OUT_DIR/corpus.err" >&2
  cat > "$OUT_DIR/corpus.md" <<EOF
# Corpus map — $STORY_ID (failed)

Sub-agent exited rc=$rc_corpus. Parent should gather corpus context manually.
EOF
fi
if [ "$rc_conv" -ne 0 ]; then
  echo "WARN: conventions sub-agent failed (rc=$rc_conv). See $OUT_DIR/conventions.err" >&2
  cat > "$OUT_DIR/conventions.md" <<EOF
# Conventions audit — $STORY_ID (failed)

Sub-agent exited rc=$rc_conv. Parent should read .agents/project-context.md directly.
EOF
fi

SYNTH_INPUT="WAVE_KIND: pre-story-research
STORY_ID: $STORY_ID

Read these two short reports and synthesize per your output schema:
- corpus_map: $OUT_DIR/corpus.md
- conventions_audit: $OUT_DIR/conventions.md
"

echo "wave-research: synthesizing..."
rc_synth=0
"$PI_BIN" --print --no-session \
    --append-system-prompt "$SYNTH_PROMPT" \
    "$SYNTH_INPUT" > "$OUT_DIR/synthesis.md" 2> "$OUT_DIR/synthesis.err" || rc_synth=$?

if [ "$rc_synth" -ne 0 ]; then
  echo "WARN: synthesize sub-agent failed (rc=$rc_synth)." >&2
  cat > "$OUT_DIR/synthesis.md" <<EOF
# Wave synthesis — $STORY_ID (synthesizer failed)

The synthesizer sub-agent failed. Raw outputs:
- $OUT_DIR/corpus.md
- $OUT_DIR/conventions.md

Parent should read them directly.
EOF
fi

# Clean up empty .err files (Pi sometimes emits nothing to stderr).
for f in "$OUT_DIR"/*.err; do
  [ -f "$f" ] && [ ! -s "$f" ] && rm -f "$f"
done

echo "wave-research: done → $OUT_DIR/synthesis.md"
