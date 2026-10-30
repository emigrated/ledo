#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." >/dev/null 2>&1; pwd)"

echo "[ensure_completion] Starting orchestration..."
bash "$ROOT_DIR/.ultrawork/orchestrator.sh" >/tmp/auto_run.log 2>&1 || true

echo "[ensure_completion] Verifying completion status..."
bash "$ROOT_DIR/.ultrawork/verify_completion.sh" | tee -a /tmp/verify_completion.log

STATUS_CMD="bash -lc 'bash "$ROOT_DIR/.ultrawork/verify_completion.sh"'"
STATUS=$($STATUS_CMD 2>/dev/null || true)
echo "[ensure_completion] Status: ${STATUS:-UNKNOWN}"
