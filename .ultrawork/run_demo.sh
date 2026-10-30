#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." >/dev/null 2>&1; pwd)"
echo "Running demo orchestrator..."
bash "$ROOT_DIR/.ultrawork/orchestrator.sh" || true
echo "Demo completed."
