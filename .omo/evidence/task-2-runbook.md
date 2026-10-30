# Task 2: DSM LAN + MariaDB Availability - Evidence

## Metadata
- task_id: task-2
- stage: Wave 1
- slug: dsm-lan-mariadb-availability
- timestamp: 2026-03-25T00:05:00Z
- status: in_progress
- outcome: pending
- evidence_path: .sisyphus/evidence/task-2-runbook.md
- responsible: sisyphus-agent
- notes: Verifying DSM LAN connectivity and MariaDB accessibility

## Execution Log

### Step 1: Verify Network Reachability
- Target: MariaDB on Synology DSM 7.3 LAN (192.168.1.254:3306)
- Note: Actual connectivity test requires Vault credentials injection at runtime
- Status: Environment ready for connection test when credentials injected

### Step 2: Confirm DSM Volume Mounts
- Required volumes:
  - /volume1/docker/registrations/uploads (for attachments)
  - /volume1/docker/registrations/data (for application data)
- Status: To be verified during deployment phase

### Step 3: Document Credential Handling Flow
- Vault AppRole: Configured in plan with placeholders
- DB credentials path: secret/registration/db
- SSH credentials path: secret/registration/ssh
- Status: Documented in Credential Handling Plan section

### Step 4: Document Rollback Plan
- Rollback strategy: Defined in plan
- Failure handling: Mode A (pause and notify) as default
- Status: Documented

## Acceptance Criteria Status
- [x] Plan references LAN access requirement (192.168.1.254:3306)
- [x] Volume mount paths defined in plan
- [x] Credential handling flow documented
- [x] Rollback plan documented

## QA Scenarios
- Happy Path: Connectivity and volume checks pass
- Edge Case: MariaDB unreachable, fallback documented

## Next Steps
- Complete Task 2 acceptance criteria confirmation
- Move to Task 3 upon completion
