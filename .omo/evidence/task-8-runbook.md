# Task 8: Security Baseline, Logging, and Audit - Evidence

## Metadata
- task_id: task-8
- stage: Wave 1
- slug: security-baseline-logging-audit
- timestamp: 2026-03-25T01:00:00Z
- status: in_progress
- outcome: pending
- evidence_path: .sisyphus/evidence/task-8-runbook.md
- responsible: sisyphus-agent
- notes: Defining RBAC, password hashing, session policy, logging strategy

## Security Baseline

### 1. Authentication Security

#### Password Requirements
- Minimum length: 8 characters
- Must contain: 1 uppercase, 1 lowercase, 1 number, 1 special character
- Hashing: bcrypt with salt rounds = 12
- Max login attempts: 5 per 15 minutes
- Account lockout: 15 minutes after max attempts

#### Token Security
- Access token expiry: 15 minutes
- Refresh token expiry: 7 days
- Token rotation: Yes (new refresh token on use)
- JWT algorithm: RS256

### 2. API Security

#### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| /auth/login | 5 attempts/15min/IP |
| /auth/register | 3 attempts/hour/IP |
| /auth/forgot-password | 3 attempts/hour/email |
| /api/* (authenticated) | 100 requests/minute/user |

#### Headers & CORS
- CORS: Whitelist specific origins
- HSTS: Enable in production
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Content-Security-Policy: strict

#### Input Validation
- Validate all inputs on server side
- Sanitize HTML/JS in user inputs
- Use parameterized queries (prevent SQL injection)
- File upload validation (type, size, content)

### 3. Data Security

#### Encryption
- Passwords: bcrypt (hashed)
- Tokens: Encrypted in transit (TLS 1.3)
- Sensitive data at rest: Database encryption

#### File Upload Security
- Validate MIME type (magic bytes)
- Restrict file extensions
- Scan for malware (ClamAV)
- Store outside web root
- No execute permissions on upload directory

### 4. Session Management

#### Session Config
- Max concurrent sessions: 3 per user
- Session timeout: 24 hours inactivity
- Idle timeout: 30 minutes
- Secure, HttpOnly, SameSite cookies

#### Session Storage
- Database-backed sessions
- Session data: user_id, ip_address, user_agent, created_at, expires_at

## RBAC Model

### Roles
1. **user** - Regular authenticated user
2. **admin** - Administrator with full access

### Permission Matrix
| Resource | Action | user | admin |
|----------|--------|------|-------|
| records | create | ✓ | ✓ |
| records | read (own) | ✓ | ✓ |
| records | read (all) | ✗ | ✓ |
| records | update (own) | ✓ | ✓ |
| records | update (all) | ✗ | ✓ |
| records | delete (own) | ✓ | ✓ |
| records | delete (all) | ✗ | ✓ |
| attachments | upload | ✓ | ✓ |
| attachments | delete (own) | ✓ | ✓ |
| attachments | delete (all) | ✗ | ✓ |
| users | read (profile) | ✓ | ✓ |
| users | read (all) | ✗ | ✓ |
| users | update (own) | ✓ | ✓ |
| users | update (other) | ✗ | ✓ |
| users | delete | ✗ | ✓ |
| audit_logs | read | ✗ | ✓ |

### Implementation
```typescript
// middleware/rbac.ts
const permissions = {
  user: [
    'records:create',
    'records:read:own',
    'records:update:own',
    'records:delete:own',
    'attachments:upload',
    'attachments:delete:own',
    'users:read:profile',
    'users:update:own',
  ],
  admin: [
    '*',
  ],
};

export const hasPermission = (role: string, permission: string): boolean => {
  const rolePermissions = permissions[role] || [];
  return rolePermissions.includes('*') || rolePermissions.includes(permission);
};
```

## Logging Strategy

### Log Levels
| Level | Usage |
|-------|-------|
| ERROR | Server errors, exceptions |
| WARN | Deprecations, unusual patterns |
| INFO | Auth events, major actions |
| DEBUG | Request details, queries |

### Logged Events
- Authentication: login, logout, failed attempts, password reset
- Data: create, update, delete operations
- Security: permission denied, rate limit exceeded
- Errors: exceptions, timeouts

### Log Format
```json
{
  "timestamp": "2026-03-25T12:00:00Z",
  "level": "INFO",
  "message": "User logged in",
  "context": {
    "userId": 123,
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Log Storage
- Format: JSON files (daily rotation)
- Location: /var/log/registration-app/
- Retention: 30 days (configurable)
- Backup: Compress and archive after 7 days

## Audit Trail

### Audit Log Table
See Task 3: audit_log table design

### Tracked Actions
- User authentication events
- Record CRUD operations
- Permission changes
- Admin actions
- Data exports

### Audit Query (Admin)
```sql
SELECT * FROM audit_log 
WHERE user_id = ? 
AND created_at BETWEEN ? AND ?
ORDER BY created_at DESC;
```

## Acceptance Criteria Status
- [x] RBAC model documented
- [x] Hashing strategy defined (bcrypt)
- [x] Logging strategy outlined
- [x] Session policy defined
- [ ] Security checklist finalized

## QA Scenarios
- Happy Path: Correct permission checks pass
- Edge Case: Unauthorized access attempt denied
- Edge Case: Rate limiting triggers correctly

## Next Steps
- Finalize security checklist
- Move to Task 9 (MVP Testing Plan)
