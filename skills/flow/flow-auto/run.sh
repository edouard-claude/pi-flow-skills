#!/usr/bin/env bash
# flow-auto/run.sh — orchestre la boucle /flow-story → /flow-dev → /flow-review → /flow-commit
# sur toutes les stories ready-for-dev du sprint, en relançant Pi en mode --no-session
# entre chaque (équivalent /clear).
#
# Usage: bash ~/.pi/agent/skills/flow/flow-auto/run.sh [.agents/implementation/sprint-status.yaml]

set -euo pipefail

STATUS="${1:-.agents/implementation/sprint-status.yaml}"
PI_BIN="${PI_BIN:-pi}"

# Mode batch : les skills concernés (flow-story, flow-dev, flow-commit) skippent
# les gates utilisateur (Attends GO, menus, validation Apply/Edit/Cancel) car
# pi --print n'a pas de stdin interactif.
export FLOW_AUTO=1

# Streaming des events Pi pour visibilité live (au lieu d'un écran muet).
# Override possible : PI_MODE=text pour sortie texte concaténée à la fin.
PI_MODE="${PI_MODE:-json}"

if [ ! -f "$STATUS" ]; then
  echo "ERREUR : sprint-status introuvable : $STATUS" >&2
  echo "Lance /flow-sprint d'abord." >&2
  exit 1
fi

if ! command -v "$PI_BIN" >/dev/null 2>&1; then
  echo "ERREUR : binaire pi introuvable. Set PI_BIN ou installe Pi." >&2
  exit 1
fi

if ! command -v uvx >/dev/null 2>&1; then
  echo "ERREUR : uvx requis pour parser le YAML. Installe uv (https://docs.astral.sh/uv/)." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERREUR : jq requis pour formater le flux JSON Pi." >&2
  echo "  macOS:    brew install jq" >&2
  echo "  Linux:    apt install jq  (ou équivalent)" >&2
  echo "  bypass:   PI_RAW=1 bash $0  (sortie JSON brute, sans jq)" >&2
  if [ "${PI_RAW:-0}" != "1" ]; then
    exit 1
  fi
fi

# Pré-vol : skills flow-* doivent être chargés dans Pi.
# On vérifie la présence sur disque (Pi les découvre récursivement).
SKILLS_ROOT="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/skills"
if ! find "$SKILLS_ROOT" -type d -name "flow-story" 2>/dev/null | grep -q .; then
  echo "ERREUR : skills flow-* introuvables sous $SKILLS_ROOT" >&2
  echo "Installe le package :" >&2
  echo "  pi install git:github.com/edouard-claude/pi-flow-skills@v0.1.1" >&2
  exit 1
fi

next_story() {
  uvx --quiet --with pyyaml python3 - "$STATUS" <<'PY'
import sys, yaml
path = sys.argv[1]
with open(path) as f:
    data = yaml.safe_load(f)
stories = data.get("stories", [])
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

# System prompt batch : interdit toute pause user, force auto-action.
# Pattern emprunté à bmad_automated (Claude CLI + --dangerously-skip-permissions
# + prompts qui disent "do not ask clarifying questions").
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

You are inside a bash loop that pipelines flow-story → flow-dev → flow-review →
flow-commit per story across the whole sprint. Each invocation must terminate
on its own (no infinite wait).
EOF

# Formatter jq : transforme le flux JSON Pi en texte lisible en live.
# - thinking_delta / text_delta : concaténation des chunks (raw output)
# - tool_use_start : ligne marquée [TOOL: name]
# - tool_use_complete : ligne [/TOOL]
# - message_complete : double newline pour séparer les tours
# Désactive le formatter avec PI_RAW=1 (utile pour debug du JSON brut).
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
  echo ">>> phase: $phase  story: $story  (session: ephémère, mode: $PI_MODE)"
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
    echo "ERREUR : /$phase $story a échoué (code $rc)" >&2
    return 1
  fi
}

total=0
while true; do
  STORY=$(next_story)
  if [ -z "$STORY" ]; then
    echo "Plus de stories à traiter. Terminé après $total stories."
    exit 0
  fi

  total=$((total + 1))
  echo ""
  echo "=========================================="
  echo "  STORY #$total : $STORY"
  echo "=========================================="

  run_phase "flow-story"  "$STORY" || exit 1

  status=$(story_status "$STORY")
  if [ "$status" != "ready-for-dev" ]; then
    echo "ABORT : après flow-story, $STORY est en '$status' (attendu: ready-for-dev)" >&2
    exit 1
  fi

  run_phase "flow-dev" "$STORY" || exit 1

  status=$(story_status "$STORY")
  if [ "$status" != "review" ]; then
    echo "ABORT : après flow-dev, $STORY est en '$status' (attendu: review, ou halt condition)" >&2
    exit 1
  fi

  attempts=0
  while [ "$(story_status "$STORY")" = "review" ] || [ "$(story_status "$STORY")" = "in-progress" ]; do
    attempts=$((attempts + 1))
    if [ "$attempts" -gt 3 ]; then
      echo "ABORT : trop de cycles dev/review sur $STORY (3 tentatives)" >&2
      exit 1
    fi
    run_phase "flow-review" "$STORY" || exit 1
    status=$(story_status "$STORY")
    if [ "$status" = "in-progress" ]; then
      run_phase "flow-dev" "$STORY" || exit 1
    fi
  done

  status=$(story_status "$STORY")
  if [ "$status" != "review" ] && [ "$status" != "done" ]; then
    echo "ABORT : état inattendu avant commit : '$status'" >&2
    exit 1
  fi

  run_phase "flow-commit" "$STORY" || exit 1

  status=$(story_status "$STORY")
  if [ "$status" != "done" ]; then
    echo "ABORT : après flow-commit, $STORY est en '$status' (attendu: done)" >&2
    exit 1
  fi

  echo "OK : $STORY → done"
done
