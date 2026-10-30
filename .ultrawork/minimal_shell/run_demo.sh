#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." >/dev/null 2>&1; pwd)"
STATE_FILE="$ROOT_DIR/.ultrawork/state.json"
LOG_DIR="$ROOT_DIR/minimal_shell/logs"
mkdir -p "$LOG_DIR"
RUN_ID=$(date +%Y%m%d%H%M%S)

echo "Demo run: idempotent two-step task" | tee -a "$LOG_DIR/run.log"

# Step 1: create demo file
DEMO_FILE="$ROOT_DIR/demo_output.txt"
if [ ! -f "$DEMO_FILE" ]; then
  echo "step1: created by demo" > "$DEMO_FILE"
  echo "Step 1 completed: $DEMO_FILE" | tee -a "$LOG_DIR/run.log"
else
  echo "Step 1 already done" | tee -a "$LOG_DIR/run.log"
fi

# Step 2: append to log
echo "step2: log entry" >> "$LOG_DIR/run.log"

echo '{"run_id":"'${RUN_ID}'","steps":[{"name":"step1","status":"completed"},{"name":"step2","status":"completed"}]}' > "$STATE_FILE" 2>/dev/null || true

echo "Demo finished" | tee -a "$LOG_DIR/run.log"
