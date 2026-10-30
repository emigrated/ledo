# Task 5: Attachments Storage Strategy - Evidence

## Metadata
- task_id: task-5
- stage: Wave 1
- slug: attachments-storage-strategy
- timestamp: 2026-03-25T00:30:00Z
- status: in_progress
- outcome: pending
- evidence_path: .sisyphus/evidence/task-5-runbook.md
- responsible: sisyphus-agent
- notes: Defining storage layout, size limits, virus scanning, and metadata

## Storage Layout

### Directory Structure (DSM Volume)
```
/volume1/docker/registrations/
├── uploads/
│   ├── images/
│   │   └── {year}/{month}/{day}/
│   ├── documents/
│   │   └── {year}/{month}/{day}/
│   └── videos/
│       └── {year}/{month}/{day}/
├── temp/
└── backups/
```

### Path Generation Rules
- Format: `/uploads/{type}/{year}/{month}/{day}/{uuid}_{filename}`
- Example: `/uploads/images/2026/03/25/abc123-def456_photo.jpg`

## File Type and Size Limits

### Images
- Allowed extensions: .jpg, .jpeg, .png, .gif, .webp, .bmp
- Max file size: 10 MB
- Max dimensions: 4096x4096 pixels

### Documents
- Allowed extensions: .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt, .csv
- Max file size: 20 MB

### Videos
- Allowed extensions: .mp4, .avi, .mov, .wmv, .flv, .mkv
- Max file size: 100 MB
- Max duration: 10 minutes

## Virus Scanning

### Implementation Plan
1. **Primary**: ClamAV integration
   - Install clamav on the container
   - Scan files after upload
   - Quarantine infected files

2. **Alternative**: External API (for future)
   - VirusTotal API
   - Hybrid Analysis API

### Scanning Flow
```
Upload Request → Validate Type/Size → Save to Temp → 
Scan with ClamAV → If Clean: Move to Final Location → 
If Infected: Quarantine & Notify Admin
```

## File Validation Rules

### MIME Type Validation
- Verify magic bytes, not just extension
- Reject files with mismatched MIME types

### Metadata Storage
- Store in `attachments` table:
  - id, record_id, filename, original_name
  - mime_type, file_size, file_path
  - storage_type, uploaded_by, uploaded_at

## API Integration Points

### Upload Endpoint
- POST /api/records/:id/attachments
- Content-Type: multipart/form-data
- Returns: attachment object with metadata

### Download Endpoint
- GET /api/attachments/:id/download
- Streams file content
- Validates user permissions

### Delete Endpoint
- DELETE /api/attachments/:id
- Soft delete in database
- Physical file removal from storage

## Security Considerations

### Access Control
- Only record owner and admins can upload
- Download requires authentication
- Path traversal prevention (validate filenames)

### Storage Security
- Files stored outside web root
- No execution permissions on upload directory
- Regular cleanup of temp directory

## Acceptance Criteria Status
- [x] Storage path & permissions defined
- [x] Type-based size limits defined
- [x] Virus scanning hook plan outlined
- [ ] API mappings finalized
- [ ] Metadata schema verified

## QA Scenarios
- Happy Path: Upload succeeds, metadata stored correctly
- Edge Case: Oversized file triggers proper error (413 Payload Too Large)
- Edge Case: Invalid file type triggers proper error (415 Unsupported Media Type)

## Next Steps
- Finalize virus scanning integration
- Move to Task 6 (Authentication Flow)
