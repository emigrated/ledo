#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="$(pwd)/.ultrawork/state.json"
EVIDENCE_FILE="$(pwd)/.ultrawork/evidence.log"
MEMORY_STORE="$(pwd)/.ultrawork/memory_store.json"

if [ ! -f "$STATE_FILE" ]; then
  echo "state missing" >&2
  exit 1
fi

TASK_MANIFEST="$(pwd)/.ultrawork/Task_manifest.json"
if [ -f "$MEMORY_STORE" ]; then
  if command -v jq >/dev/null; then
    if [ -f "$TASK_MANIFEST" ]; then
      STEPS=$(jq -r '.steps[].name' "$TASK_MANIFEST" 2>/dev/null || echo '')
      ALL_DONE=true
      for s in $STEPS; do
        if ! jq -e ".ledger[]? | select(.step==\"$s\" and .status==\"completed\")" "$MEMORY_STORE" >/dev/null 2>&1; then
          ALL_DONE=false
          break
        fi
      done
      if [ "$ALL_DONE" = true ]; then
        echo "DONE"
        exit 0
      fi
    else
      if jq -e '.[] | select(.mode == "auto" and .status == "completed")' "$MEMORY_STORE" >/dev/null; then
        echo "DONE"
        exit 0
      fi
    fi
  fi
fi

STATE=$(cat "$STATE_FILE")
if echo "$STATE" | grep -q '"lint"' && echo "$STATE" | grep -q '"tests"' && echo "$STATE" | grep -q '"build"' && echo "$STATE" | grep -q '"status"'; then
  echo "DONE"
  exit 0
else
  echo "INCOMPLETE"
  exit 1
fi
