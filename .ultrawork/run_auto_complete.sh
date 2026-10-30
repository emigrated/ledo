#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." >/dev/null 2>&1; pwd)"

# Trigger the end-to-end orchestration auto path
bash "$ROOT_DIR/.ultrawork/orchestrator.sh" > "$ROOT_DIR/.ultrawork/logs/orchestrator_run.log" 2>&1 || true

# Verify completion status and emit logs
bash "$ROOT_DIR/.ultrawork/verify_completion.sh" > "$ROOT_DIR/.ultrawork/logs/verify_run.log" 2>&1 || true
cat "$ROOT_DIR/.ultrawork/logs/verify_run.log" || true
