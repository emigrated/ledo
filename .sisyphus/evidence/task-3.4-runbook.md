# Task 3.4 Runbook: 审计日志强化

## Metadata
- task_id: task-3.4
- stage: Wave 3
- slug: audit-log-enhance
- timestamp: 2026-03-25T01:25:00Z
- status: pending
- evidence_path: .sisyphus/evidence/task-3.4-runbook.md
- responsible: plan-agent
- notes: Extend audit_log with more fields

## Execution Plan
- 1) Extend audit_log schema: include action, entity_type, entity_id, details, ip_address
- 2) Add admin API to fetch audit logs with filters
- 3) Ensure logs written on critical actions

## Acceptance Criteria
- [ ] Audit table schema extended
- [ ] Admin audit log query works
- [ ] Sensitive data masked in logs

## QA Scenarios
- Happy Path: view logs for a user
- Edge Case: large audit log volume
