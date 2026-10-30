Acceptance Criteria - Step 2: Minimal Auto-automation Skeleton

- DoD: A minimal orchestrator and a runner exist, capable of a two-phase execution (dry-run and live-run) and emitting a final completion signal. State persistence is initialized to a local ledger file, and a simple evidence artifact can be produced.
- Verification: A dry-run should not perform destructive actions; a live-run should complete with a final status written to the ledger. The orchestrator must output a final Dynamo-style completion signal (<promise>DONE</promise>).
- Non-functional: No external dependencies; path structure consistent with previous steps; logs written to .ultrawork/logs.
- Security: No real secrets involved in this skeleton; placeholders only.
