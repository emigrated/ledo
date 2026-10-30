#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." >/dev/null 2>&1; pwd)"
RUN_MODE="${1:-live}"

if [ "$RUN_MODE" = "true" ] || [ "$RUN_MODE" = "dry-run" ]; then
  "$ROOT_DIR/minimal_shell/runner.sh" --dry-run
else
  "$ROOT_DIR/minimal_shell/runner.sh"
fi
