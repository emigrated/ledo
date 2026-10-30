# Task 3.1 Runbook: Records 搜索与筛选增强

## Metadata
- task_id: task-3.1
- stage: Wave 3
- slug: records-search-enhance
- timestamp: 2026-03-25T01:10:00Z
- status: pending
- evidence_path: .sisyphus/evidence/task-3.1-runbook.md
- responsible: plan-agent
- notes: Skeleton runbook for records search enhancement

## Execution Plan
- 1) Implement backend search API: GET /api/records with filters (query, status, category, from, to, page, limit)
- 2) Integrate with existing permissions: ensure only authorized records returned
- 3) Extend Records UI: search input, filters, and result card
- 4) Add unit/integration tests for search filters

## Acceptance Criteria
- [ ] Backend supports full-text search on title/content and filters for status, category, date range
- [ ] Paginated results with total count
- [ ] Frontend search UI wired to API
- [ ] Access control respects user permissions

## QA Scenarios
- Happy Path: search by keyword + date range + category
- Edge Case: no results
- Edge Case: invalid date formats
