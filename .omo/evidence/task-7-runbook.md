# Task 7: Frontend Electron UI Skeleton - Evidence

## Metadata
- task_id: task-7
- stage: Wave 1
- slug: frontend-electron-ui-skeleton
- timestamp: 2026-03-25T00:50:00Z
- status: in_progress
- outcome: pending
- evidence_path: .sisyphus/evidence/task-7-runbook.md
- responsible: sisyphus-agent
- notes: Outlining Electron UI for login/register/records, API integration

## Technology Stack

### Frontend Framework
- React 18+ with TypeScript
- Electron 28+ for desktop packaging
- Vite for build tooling

### State Management
- React Context + useReducer for auth state
- React Query for server state

### UI Library
- Material UI or Ant Design
- Responsive design

## Application Structure

```
registration-app/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts
│   │   ├── preload.ts
│   │   └── ipc/
│   ├── renderer/       # React app
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── context/
│   │   ├── hooks/
│   │   └── utils/
│   └── shared/         # Shared types
├── public/
├── electron-builder.json
└── package.json
```

## Screen Designs

### 1. Login Screen
- Email/Password fields
- "Remember me" checkbox
- "Forgot Password?" link
- "Register" link
- Role toggle (User/Admin) - optional at login

### 2. Register Screen
- Username field
- Email field
- Password field (with strength indicator)
- Confirm password field
- Terms acceptance checkbox
- "Login" link (already have account)

### 3. Forgot Password Screen
- Email field
- Submit button
- "Back to Login" link

### 4. Dashboard (After Login)
- Navigation sidebar
- Header with user info
- Main content area
- Quick actions

### 5. Records List Screen
- Search bar
- Filter dropdowns (status, category)
- Table/Grid view of records
- Pagination
- "New Record" button

### 6. Record Detail/Create Screen
- Title input
- Content textarea
- Category dropdown
- File upload area
- Save/Submit buttons

### 7. User Profile Screen
- View/Edit profile
- Change password
- Logout button

### 8. Admin Panel (Admin only)
- User management
- All records view
- Audit logs

## API Integration

### Authentication Service
```typescript
// services/auth.ts
export const authService = {
  login: (credentials: LoginCredentials) => 
    api.post<AuthResponse>('/auth/login', credentials),
  
  register: (data: RegisterData) => 
    api.post('/auth/register', data),
  
  logout: () => 
    api.post('/auth/logout'),
  
  forgotPassword: (email: string) => 
    api.post('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) => 
    api.post('/auth/reset-password', { token, newPassword: password }),
  
  verifyEmail: (token: string) => 
    api.post('/auth/verify-email', { token }),
};
```

### Records Service
```typescript
// services/records.ts
export const recordsService = {
  getAll: (params: QueryParams) => 
    api.get<PaginatedResponse<Record>>('/records', { params }),
  
  getById: (id: number) => 
    api.get<Record>(`/records/${id}`),
  
  create: (data: CreateRecordData) => 
    api.post<Record>('/records', data),
  
  update: (id: number, data: UpdateRecordData) => 
    api.put<Record>(`/records/${id}`, data),
  
  delete: (id: number) => 
    api.delete(`/records/${id}`),
  
  uploadAttachment: (recordId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<Attachment>(`/records/${recordId}/attachments`, formData);
  },
};
```

## Token Storage (Secure)

### Strategy
- Access Token: In-memory (React state)
- Refresh Token: Electron safeStorage (encrypted)
- Never store tokens in localStorage (XSS vulnerable)

### Implementation
```typescript
// utils/tokenStorage.ts
import { safeStorage } from 'electron';

// Store refresh token securely
export const storeRefreshToken = async (token: string) => {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(token);
    await electronStore.set('refreshToken', encrypted.toString('base64'));
  }
};

// Retrieve refresh token
export const getRefreshToken = async (): Promise<string | null> => {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = await electronStore.get('refreshToken');
    if (encrypted) {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    }
  }
  return null;
};
```

## Error Handling

### Network Errors
- Show toast notification
- Retry logic for transient failures
- Offline mode indicator

### Auth Errors
- 401: Clear tokens, redirect to login
- 403: Show "Access Denied" message

## Acceptance Criteria Status
- [x] App structure defined
- [x] Screen designs outlined
- [x] API service structure defined
- [x] Token storage strategy documented
- [ ] UI components to be implemented

## QA Scenarios
- Happy Path: Login works with valid credentials
- Edge Case: Network error shows proper message
- Edge Case: Invalid token redirects to login

## Next Steps
- Implement UI components
- Wire up API calls
- Move to Task 8 (Security Baseline)
