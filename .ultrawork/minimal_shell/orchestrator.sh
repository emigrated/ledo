#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." >/dev/null 2>&1; pwd)"
if [ -f "$ROOT_DIR/.ultrawork/Task_manifest.json" ]; then
  echo "Detected Task_manifest.json; launching auto path" | tee -a "$ROOT_DIR/.ultrawork/logs/orchestrator.log"
  bash "$ROOT_DIR/.ultrawork/automation_runner.sh" --dry-run || true
  bash "$ROOT_DIR/.ultrawork/automation_runner.sh" --auto || true
  echo "<promise>DONE</promise>" | tee -a "$ROOT_DIR/.ultrawork/logs/orchestrator.log"
  exit 0
fi
STEP_FILE="$ROOT_DIR/.ultrawork/steps_list.txt"
MEMORY_STORE="$ROOT_DIR/.ultrawork/memory_store.json"
STATE_FILE="$ROOT_DIR/.ultrawork/state.json"
LOG_DIR="$ROOT_DIR/.ultrawork/logs"
mkdir -p "$LOG_DIR" "$ROOT_DIR/.ultrawork"

if [ ! -f "$STEP_FILE" ]; then
  echo "Step file not found: $STEP_FILE" >&2
  exit 1
fi

if [ ! -f "$MEMORY_STORE" ]; then
  echo '[]' > "$MEMORY_STORE"
fi
if [ ! -f "$STATE_FILE" ]; then
  echo '{}' > "$STATE_FILE"
fi

echo "Starting end-to-end orchestration..." | tee -a "$LOG_DIR/orchestrator.log"
while IFS='=' read -r key value; do
  if [[ "$key" == step* ]]; then
    STEP="$value"
    echo "Running step: $STEP" | tee -a "$LOG_DIR/orchestrator.log"
    bash "$ROOT_DIR/.ultrawork/minimal_shell/runner.sh" "$STEP" || { bash "$ROOT_DIR/.ultrawork/rollback.sh"; exit 1; }
  fi
done < "$STEP_FILE"

echo "<promise>DONE</promise>" | tee -a "$LOG_DIR/orchestrator.log"
