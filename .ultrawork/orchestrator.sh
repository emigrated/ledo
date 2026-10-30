#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." >/dev/null 2>&1; pwd)"
if [ -f "$ROOT_DIR/.ultrawork/Task_manifest.json" ]; then
  echo "Auto path detected; starting end-to-end auto flow" | tee -a "$ROOT_DIR/.ultrawork/logs/orchestrator.log"
  bash "$ROOT_DIR/.ultrawork/automation_runner.sh" --dry-run
  bash "$ROOT_DIR/.ultrawork/automation_runner.sh" --auto
  echo "<promise>DONE</promise>" | tee -a "$ROOT_DIR/.ultrawork/logs/orchestrator.log"
  exit 0
fi

echo "No auto manifest; exiting" >&2
exit 1
