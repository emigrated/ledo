Automation Completion Spec (Wave 2 Minimal End-to-End)

Objective
- Formalize and implement a minimal end-to-end automation that satisfies the original user request: 自动完成. The spec defines acceptance criteria, orchestration, memory persistence, evidence trails, rollback, and completion signaling.

Scope
- End-to-end orchestration skeleton (dry-run + live-run flow)
- Memory persistence across runs (state ledger)
- Evidence trails for auditability (evidence log / summary)
- Rollback pathway for safe failure handling
- Credential handling (Vault dummy/mock for now)

Acceptance Criteria (pass/fail)
- Orchestrator exists and can run both dry-run and live-run with zero fatal errors.
- verify_completion.sh reports DONE when lint, test, and build steps are considered successful and state is persisted.
- state.json persists across runs (new runs augment existing state).
- evidence.log/evidence.json are generated and contain run_id, timestamps, steps, and outcomes.
- Rollback mechanism exists and can restore previous state on failure.
- Credential handling is in place (mock) and not exposing secrets in logs.
- The entire process emits a final completion signal: <promise>DONE</promise>.

Implementation Plan (high level)
- Patch 1: Add formal Acceptance Criteria document (this file).
- Patch 2: Review and enhance orchestrator.sh to clearly sequence dry-run then live-run and end with DONE signal.
- Patch 3: Extend memory ledger to record step results and ensure persistence across runs.
- Patch 4: Implement a basic rollback mechanism (rollback script) and hook it into orchestrator on failure.
- Patch 5: Implement evidence trail generation (evidence.log and summary) and a minimal verify_completion script.
- Patch 6: Add a minimal test harness (lint/test/build placeholders) to demonstrate verification gates.

Notes
- This is intentionally minimal to reduce risk. We will progressively replace mocks with real implementations.
