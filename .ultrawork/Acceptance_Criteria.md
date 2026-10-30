ULTRAWORK Acceptance Criteria (Wave 2 - Minimal Automation)
- The automation runner skeleton file exists and is executable.
- A formal acceptance criteria document exists describing end-state, success metrics, and exit conditions.
- The runner records a state.json with step statuses and produces an evidence log directory.
- No live system changes are performed in this patch; all actions are dry-run safe or mockable.
- The plan aligns with the existing Wave 1 scope and memory/ledger references.

Usage notes:
- Run: ./ultrawork/automation_runner.sh --dry-run to verify behavior without side effects.
- Run: ./ultrawork/automation_runner.sh to execute the minimal automation flow.
- The script outputs a final status and writes to state.json and logs/evidence.log.

This file serves as the official minimal acceptance baseline for automatic completion work.
- Rollback/Undo: Define and implement a rollback path for the minimal automation run. Ability to revert state.json to previous snapshot and discard non-idempotent changes if a step fails. Validate rollback on a dry-run and ensure idempotent re-run.
- Evidence Trails: Ensure a complete evidence trail is produced for every run (evidence.log and an optional structured evidence.json) with run_id, timestamp, steps, outcomes, and artifacts. The runner should append to evidence log on every step.
- Rollback/Undo: Define and implement a rollback path for the minimal automation run. Ability to revert state.json to previous snapshot and discard non-idempotent changes if a step fails. Validate rollback on a dry-run and ensure idempotent re-run.
- Evidence Trails: Ensure a complete evidence trail is produced for every run (evidence.log and an optional structured evidence.json) with run_id, timestamp, steps, outcomes, and artifacts. The runner should append to evidence log on every step.
- End-to-End Orchestration: Provide a minimal orchestrator that sequences steps, invokes the runner in dry-run then live mode, and emits a completion signal (<promise>DONE</promise>).
