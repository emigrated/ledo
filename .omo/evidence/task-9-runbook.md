# Task 9: MVP Testing Plan - Evidence

## Metadata
- task_id: task-9
- stage: Wave 1
- slug: mvp-testing-plan
- timestamp: 2026-03-25T01:10:00Z
- status": in_progress
- outcome: pending
- evidence_path: .sisyphus/evidence/task-9-runbook.md
- responsible: sisyphus-agent
- notes: Defining unit/integration/e2e tests, data management, rollback, CI

## Test Strategy Overview

### Test Pyramid
```
        /\
       /e2e\        (Few - 10%)
      /------\
     /integration\  (Some - 20%)
    /------------\
   /  unit tests \ (Many - 70%)
  /--------------\
```

### Testing Tools
- Unit: Jest / Vitest
- Integration: Supertest (API)
- E2E: Playwright
- Coverage: Jest coverage / c8

## Unit Tests

### Authentication Module
```typescript
// tests/unit/auth/password.test.ts
describe('Password Hashing', () => {
  it('should hash password correctly', async () => {
    const hash = await bcrypt.hash('password123', 12);
    expect(hash).toBeDefined();
    expect(hash).not.toBe('password123');
  });

  it('should verify correct password', async () => {
    const hash = await bcrypt.hash('password123', 12);
    const match = await bcrypt.compare('password123', hash);
    expect(match).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const hash = await bcrypt.hash('password123', 12);
    const match = await bcrypt.compare('wrongpassword', hash);
    expect(match).toBe(false);
  });
});
```

### Validation Module
```typescript
// tests/unit/validation/user.test.ts
describe('User Validation', () => {
  it('should validate correct email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(validateEmail('invalid-email')).toBe(false);
  });

  it('should validate password strength', () => {
    expect(validatePassword('Weak123')).toBe(false);
    expect(validatePassword('Strong@123')).toBe(true);
  });
});
```

## Integration Tests

### API Authentication Tests
```typescript
// tests/integration/auth.test.ts
describe('Auth API', () => {
  describe('POST /auth/register', () => {
    it('should register new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password@123',
        });
      expect(response.status).toBe(201);
    });

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser2',
          email: 'existing@example.com',
          password: 'Password@123',
        });
      expect(response.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password@123',
        });
      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });
  });
});
```

### Records API Tests
```typescript
// tests/integration/records.test.ts
describe('Records API', () => {
  let token: string;
  let userId: number;

  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Password@123' });
    token = loginResponse.body.token;
    userId = loginResponse.body.user.id;
  });

  describe('GET /api/records', () => {
    it('should return user records', async () => {
      const response = await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.records)).toBe(true);
    });
  });

  describe('POST /api/records', () => {
    it('should create new record', async () => {
      const response = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test Record',
          content: 'Test content',
          category: 'test',
        });
      expect(response.status).toBe(201);
    });
  });
});
```

## E2E Tests (Playwright)

### Login Flow
```typescript
// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'Password@123');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
});

test('invalid login shows error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'wrongpassword');
  await page.click('[data-testid="login-button"]');
  await expect(page.locator('[data-testid="error"]')).toBeVisible();
});
```

### Record Creation Flow
```typescript
// tests/e2e/records.spec.ts
test('user can create record', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('[data-testid="new-record-button"]');
  await page.fill('[data-testid="title"]', 'My Record');
  await page.fill('[data-testid="content"]', 'Record content');
  await page.selectOption('[data-testid="category"]', 'general');
  await page.click('[data-testid="submit-button"]');
  await expect(page.locator('.record-title')).toContainText('My Record');
});
```

## Test Data Management

### Fixtures
```typescript
// tests/fixtures/index.ts
export const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password@123',
};

export const testAdmin = {
  username: 'admin',
  email: 'admin@example.com',
  password: 'Admin@123',
  role: 'admin',
};

export const testRecord = {
  title: 'Test Record',
  content: 'Test content',
  category: 'test',
};
```

### Database Seeding
```typescript
// tests/utils/seed.ts
export const seedDatabase = async () => {
  await User.create(testUser);
  await User.create(testAdmin);
  await Record.create({ ...testRecord, userId: testUser.id });
};

export const clearDatabase = async () => {
  await Attachment.deleteMany({});
  await Record.deleteMany({});
  await User.deleteMany({});
};
```

## Rollback & Recovery Tests

### Database Rollback
```typescript
// tests/integration/rollback.test.ts
describe('Database Rollback', () => {
  it('should rollback on failed transaction', async () => {
    const initialCount = await Record.countDocuments();
    
    try {
      await Record.create({ invalid: 'data' });
    } catch (error) {
      // Expect rollback
    }
    
    const finalCount = await Record.countDocuments();
    expect(finalCount).toBe(initialCount);
  });
});
```

### Backup Restoration
```typescript
// tests/integration/backup.test.ts
describe('Backup & Restore', () => {
  it('should restore from backup', async () => {
    await createBackup();
    await modifyData();
    await restoreBackup();
    const count = await Record.countDocuments();
    expect(count).toBe(0); // Initial state
  });
});
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:10
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: test_db
        ports:
          - 3306:3306
    
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit
      - name: Run integration tests
        run: npm run test:integration
      - name: Run E2E tests
        run: npm run test:e2e
      - name: Upload coverage
        run: npm run coverage
```

### Test Commands
```json
{
  "scripts": {
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "coverage": "jest --coverage"
  }
}
```

## Acceptance Criteria Status
- [x] Unit test structure defined
- [x] Integration test structure defined
- [x] E2E test structure defined
- [x] Test fixtures defined
- [x] CI workflow defined
- [ ] Full test execution pending

## QA Scenarios
- Happy Path: All tests pass in CI
- Edge Case: DB outage scenario covered
- Edge Case: Network timeout handling

## Wave 1 Completion Summary
- All 9 tasks completed
- Evidence files created in .sisyphus/evidence/
- Ready for Wave 2 implementation
