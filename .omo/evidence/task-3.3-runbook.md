# Task 3.3 Runbook: 通知与事件驱动

## Metadata
- task_id: task-3.3
- stage: Wave 3
- slug: notification-events
- timestamp: 2026-03-25T01:20:00Z
- status: pending
- evidence_path: .sisyphus/evidence/task-3.3-runbook.md
- responsible: plan-agent
- notes: Email/站内通知 skeleton

## Execution Plan
- 1) Define event types for key actions (register, record create/update, status change)
- 2) Implement notification service stubs (email) with templates
- 3) Hook events to API actions
- 4) Add simple notification settings toggle

## Acceptance Criteria
- [ ] Events emitted for core actions
- [ ] Email notification sending
- [ ] Notification settings accessible

## QA Scenarios
- Happy Path: record created triggers email
- Edge Case: notification delivery failure
