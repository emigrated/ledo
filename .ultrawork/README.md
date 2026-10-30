Ultrawork Runner

- Purpose: provide a minimal, safe automation scaffold for Wave 2 automation.
- Files:
  - .ultrawork/Acceptance_Criteria.md: acceptance criteria baseline.
  - .ultrawork/automation_runner.sh: minimal runner script (dry-run capable).
  - .ultrawork/state.json: persistent in-run state (created by runner).

- Usage:
  - Ensure the script has execute permissions: chmod +x .ultrawork/automation_runner.sh
  - Run dry-run: ./.ultrawork/automation_runner.sh true
  - Run real: ./.ultrawork/automation_runner.sh false

Note: This is a scaffolding piece. It does not modify live systems; it provides a reproducible outline for automation.
