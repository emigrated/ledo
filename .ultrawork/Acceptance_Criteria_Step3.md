Acceptance Criteria - Step 3: Minimal End-to-End Skeleton Demo

- DoD: A two-step end-to-end demo exists that is safe: it creates outputs and writes a state JSON indicating step status without external side effects. Logs are produced under .ultrawork/minimal_shell/logs.
- Additional: Introduce an auto path that can be triggered by a manifest and completes a minimal task, with DONE emitted and evidence written.
- Verification: Running the demo script twice should be idempotent for both steps; state.json reflects progress and demo_outputs contain a final summary.
- Artifacts: A small evidence block (evidence_demo_template.md) can be filled after the run, showing run_id, timestamps, steps, and outcomes.
- Secrets: No real secrets; only placeholders.
