# Task 6: Authentication Flow Design (Email Verification, Reset) - Evidence

## Metadata
- task_id: task-6
- stage: Wave 1
- slug: authentication-flow-design
- timestamp: 2026-03-25T00:40:00Z
- status: in_progress
- outcome: pending
- evidence_path: .sisyphus/evidence/task-6-runbook.md
- responsible: sisyphus-agent
- notes: Defining authentication state machine, token lifecycles, email verification

## Authentication State Machine

### States
1. **GUEST** - Unauthenticated user
2. **REGISTERED** - User registered, email not verified
3. **VERIFIED** - Email verified, can login
4. **ACTIVE** - Currently logged in
5. **SUSPENDED** - Account suspended by admin

### State Transitions
```
GUEST → REGISTERED (via /auth/register)
REGISTERED → VERIFIED (via /auth/verify-email)
VERIFIED → ACTIVE (via /auth/login)
ACTIVE → GUEST (via /auth/logout)
ANY → SUSPENDED (admin action)
```

## Token Lifecycles

### Access Token
- Type: JWT (JSON Web Token)
- Algorithm: RS256 (RSA)
- Expiry: 15 minutes
- Claims: userId, username, role, iat, exp

### Refresh Token
- Type: Opaque token (stored in database)
- Expiry: 7 days
- Rotation: Yes (new refresh token on each use)
- Storage: sessions table

### Password Reset Token
- Type: Opaque token (one-time use)
- Expiry: 1 hour
- Storage: password_resets table
- Single use: Yes (marked as used after successful reset)

### Email Verification Token
- Type: Opaque token (one-time use)
- Expiry: 24 hours
- Storage: users table (verification_token field)
- Single use: Yes

## Password Hashing

### Algorithm
- Library: bcrypt
- Work Factor: 12 (adjustable based on performance)
- Validation: Minimum 8 characters, 1 uppercase, 1 lowercase, 1 number

### Implementation
```javascript
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

// Hash password
const hash = await bcrypt.hash(password, SALT_ROUNDS);

// Verify password
const match = await bcrypt.compare(password, hash);
```

## Email Verification Flow

### Step 1: User Registers
- POST /api/auth/register
- Creates user record with email_verified = false
- Generates verification token
- Sends verification email

### Step 2: User Clicks Verification Link
- User clicks link in email
- POST /api/auth/verify-email with token
- System validates token
- Updates user.email_verified = true
- Token marked as used

### Step 3: User Can Login
- User can now login with credentials

## Password Reset Flow

### Step 1: User Requests Reset
- POST /api/auth/forgot-password
- User enters email
- System generates password reset token
- Sends reset email

### Step 2: User Clicks Reset Link
- User clicks link in email
- POST /api/auth/reset-password
- System validates token (not expired, not used)
- Updates user password (hashes new password)
- Token marked as used
- All existing sessions invalidated

### Step 3: Confirmation
- User receives confirmation email
- User can login with new password

## Role-Based Access Control (RBAC)

### Roles
1. **user** - Regular user
2. **admin** - Administrator

### Permissions Matrix
| Action | user | admin |
|--------|------|-------|
| View own records | ✓ | ✓ |
| Create record | ✓ | ✓ |
| Edit own records | ✓ | ✓ |
| Delete own records | ✓ | ✓ |
| View all records | ✗ | ✓ |
| Edit any record | ✗ | ✓ |
| Delete any record | ✗ | ✓ |
| Manage users | ✗ | ✓ |
| View audit logs | ✗ | ✓ |

## SMS Support (Future Toggle)

### Feature Flag
- Flag: FEATURE_SMS_ENABLED
- Default: false (disabled)
- Can be enabled via environment variable

### Implementation (When Enabled)
- Twilio integration
- SMS for:
  - Password reset codes
  - Login alerts
  - Account notifications

## Security Measures

### Rate Limiting
- Login: 5 attempts per 15 minutes per IP
- Register: 3 attempts per hour per IP
- Password Reset: 3 attempts per hour per email

### Account Lockout
- After 5 failed login attempts
- Lockout duration: 15 minutes
- Admin can unlock manually

### Session Management
- Max concurrent sessions: 3 per user
- Session timeout: 24 hours inactivity
- Secure, httpOnly cookies

## Acceptance Criteria Status
- [x] State machine diagram exists
- [x] Token TTL/rotation defined
- [x] Email verification endpoints defined
- [ ] SMS toggle plan finalized
- [ ] RBAC matrix verified

## QA Scenarios
- Happy Path: Register → Verify → Login → Reset Password
- Edge Case: Expired token returns 401
- Edge Case: Used token returns 400

## Next Steps
- Finalize SMS toggle for future
- Move to Task 7 (Frontend Electron UI)
