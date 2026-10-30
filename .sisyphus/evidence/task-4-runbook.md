# Task 4: API Design & Contracts (Express) - Evidence

## Metadata
- task_id: task-4
- stage: Wave 1
- slug: api-design-contracts-express
- timestamp: 2026-03-25T00:20:00Z
- status: in_progress
- outcome: pending
- evidence_path: .sisyphus/evidence/task-4-runbook.md
- responsible: sisyphus-agent
- notes: Drafting REST API contracts for authentication, users, records, and attachments

## API Endpoints Design

### Authentication Endpoints

#### POST /api/auth/register
- Description: Register a new user
- Request Body:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```
- Response (201):
```json
{
  "message": "Registration successful. Please verify your email.",
  "userId": "number"
}
```

#### POST /api/auth/login
- Description: User login
- Request Body:
```json
{
  "email": "string",
  "password": "string"
}
```
- Response (200):
```json
{
  "token": "string",
  "refreshToken": "string",
  "user": {
    "id": "number",
    "username": "string",
    "email": "string",
    "role": "string"
  }
}
```

#### POST /api/auth/logout
- Description: User logout
- Headers: Authorization: Bearer <token>
- Response (200):
```json
{
  "message": "Logged out successfully"
}
```

#### POST /api/auth/forgot-password
- Description: Request password reset
- Request Body:
```json
{
  "email": "string"
}
```
- Response (200):
```json
{
  "message": "Password reset email sent"
}
```

#### POST /api/auth/reset-password
- Description: Reset password with token
- Request Body:
```json
{
  "token": "string",
  "newPassword": "string"
}
```
- Response (200):
```json
{
  "message": "Password reset successful"
}
```

#### POST /api/auth/verify-email
- Description: Verify email with token
- Request Body:
```json
{
  "token": "string"
}
```
- Response (200):
```json
{
  "message": "Email verified successfully"
}
```

### User Endpoints

#### GET /api/users/me
- Description: Get current user profile
- Headers: Authorization: Bearer <token>
- Response (200):
```json
{
  "id": "number",
  "username": "string",
  "email": "string",
  "role": "string",
  "isActive": "boolean",
  "emailVerified": "boolean",
  "createdAt": "timestamp"
}
```

#### PUT /api/users/me
- Description: Update current user profile
- Headers: Authorization: Bearer <token>
- Request Body:
```json
{
  "username": "string",
  "email": "string"
}
```
- Response (200):
```json
{
  "message": "Profile updated",
  "user": {}
}
```

### Record Endpoints (登记记录)

#### GET /api/records
- Description: List records (with pagination and filters)
- Headers: Authorization: Bearer <token>
- Query Params: page, limit, status, category, search
- Response (200):
```json
{
  "records": [],
  "total": "number",
  "page": "number",
  "limit": "number"
}
```

#### POST /api/records
- Description: Create a new record
- Headers: Authorization: Bearer <token>
- Request Body:
```json
{
  "title": "string",
  "content": "string",
  "category": "string"
}
```
- Response (201):
```json
{
  "message": "Record created",
  "record": {}
}
```

#### GET /api/records/:id
- Description: Get record by ID
- Headers: Authorization: Bearer <token>
- Response (200):
```json
{
  "id": "number",
  "title": "string",
  "content": "string",
  "category": "string",
  "status": "string",
  "attachments": [],
  "createdAt": "timestamp"
}
```

#### PUT /api/records/:id
- Description: Update record
- Headers: Authorization: Bearer <token>
- Request Body:
```json
{
  "title": "string",
  "content": "string",
  "category": "string",
  "status": "string"
}
```
- Response (200):
```json
{
  "message": "Record updated",
  "record": {}
}
```

#### DELETE /api/records/:id
- Description: Delete record
- Headers: Authorization: Bearer <token>
- Response (200):
```json
{
  "message": "Record deleted"
}
```

### Attachment Endpoints

#### POST /api/records/:id/attachments
- Description: Upload attachment
- Headers: Authorization: Bearer <token>, Content-Type: multipart/form-data
- Body: file (multipart)
- Response (201):
```json
{
  "message": "File uploaded",
  "attachment": {}
}
```

#### DELETE /api/attachments/:id
- Description: Delete attachment
- Headers: Authorization: Bearer <token>
- Response (200):
```json
{
  "message": "Attachment deleted"
}
```

### Admin Endpoints

#### GET /api/admin/users
- Description: List all users (admin only)
- Headers: Authorization: Bearer <token>
- Response (200):
```json
{
  "users": []
}
```

#### GET /api/admin/records
- Description: List all records with审核 (admin only)
- Headers: Authorization: Bearer <token>
- Response (200):
```json
{
  "records": []
}
```

#### PUT /api/admin/records/:id/approve
- Description: Approve record (admin only)
- Headers: Authorization: Bearer <token>
- Response (200):
```json
{
  "message": "Record approved"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": []
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Acceptance Criteria Status
- [x] API endpoints defined for auth, users, records, attachments
- [x] Request/response schemas documented
- [x] Error handling strategy defined
- [ ] OpenAPI spec to be generated
- [ ] Data model mapping verified

## QA Scenarios
- Happy Path: Valid request/response patterns work correctly
- Edge Case: Invalid payload returns proper 4xx error codes

## Next Steps
- Generate OpenAPI specification
- Verify API contracts align with data model
- Move to Task 5 (Attachments Storage)
