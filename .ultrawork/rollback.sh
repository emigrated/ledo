#!/usr/bin/env bash
set -euo pipefail
STATE_FILE="$(pwd)/.ultrawork/state.json"
BACKUP_FILE="${STATE_FILE}.bak"

if [ -f "$STATE_FILE" ]; then
  cp "$STATE_FILE" "$BACKUP_FILE"
  echo "Rollback: backup created at $BACKUP_FILE" >&2
fi

# Minimal rollback: restore backup if exists
if [ -f "$BACKUP_FILE" ]; then
  mv "$BACKUP_FILE" "$STATE_FILE"
  echo "Rollback: state restored" >&2
fi

exit 0
