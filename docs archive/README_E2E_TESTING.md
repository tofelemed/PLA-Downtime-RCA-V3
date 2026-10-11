# 🤖 Automated UI Testing with Backend Integration

This guide explains how to run automated UI tests that use real backend data.

## 📋 Overview

We use **Playwright** for end-to-end (E2E) testing and **Vitest** for integration tests. Both test suites interact with the actual backend API running on port 4004.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### 2. Start Backend Server

The tests will automatically start the backend server, but you can also start it manually:

```bash
cd server/pro-act-backend
npm run start:dev
```

### 3. Run E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run tests in UI mode (interactive)
npx playwright test --ui

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests with debug mode
npx playwright test --debug
```

### 4. Run Integration Tests

```bash
# Run all integration tests
npm run test:run

# Run specific integration test
npm run test:run src/test/integration/master-data.integration.test.ts
```

## 📁 Test Structure

```
e2e/
├── test-utils/
│   ├── api-helpers.ts       # Backend API utilities
│   ├── auth-helpers.ts      # Authentication helpers
│   └── test-fixtures.ts     # Test data fixtures
├── auth.spec.ts             # Authentication tests
├── master-data.spec.ts      # Master data tests
└── production.spec.ts       # Production module tests

src/test/integration/
├── api-test-helpers.ts      # Vitest API helpers
└── master-data.integration.test.ts  # Integration tests
```

## 🧪 Writing Tests

### E2E Test Example (Playwright)

```typescript
import { test, expect } from '@playwright/test';
import { loginViaAPI } from './test-utils/auth-helpers';
import { createTestFixture } from './test-utils/test-fixtures';

test('should create organization', async ({ page }) => {
  // Setup: Login and create test data
  await loginViaAPI(page);
  const fixture = await createTestFixture();
  
  // Test: Navigate and interact
  await page.goto('/master-data/organizations');
  await page.click('button:has-text("Create")');
  await page.fill('input[name="name"]', 'New Org');
  await page.click('button[type="submit"]');
  
  // Verify: Check result
  await expect(page.locator('text=New Org')).toBeVisible();
  
  // Cleanup
  await fixture.cleanup();
});
```

### Integration Test Example (Vitest)

```typescript
import { describe, it, expect } from 'vitest';
import { getTestAuthTokens, authenticatedRequest } from './api-test-helpers';

describe('My Feature', () => {
  it('should create resource', async () => {
    const tokens = await getTestAuthTokens();
    
    const resource = await authenticatedRequest('/resources', {
      method: 'POST',
      body: { name: 'Test' },
      token: tokens.accessToken,
    });
    
    expect(resource.id).toBeDefined();
  });
});
```

## 🛠️ Test Utilities

### API Helpers

- `authenticate(email, password)` - Login and get tokens
- `apiRequest(endpoint, options)` - Make authenticated API calls
- `createTestOrganization(token, name)` - Create test organization
- `createTestTenant(token, orgId, name)` - Create test tenant
- `cleanupTestData(token, resourceIds)` - Clean up test data

### Auth Helpers

- `loginViaUI(page, email, password)` - Login through UI
- `loginViaAPI(page)` - Login via API and set token
- `logoutViaUI(page)` - Logout through UI
- `ensureTestUser(email, password)` - Ensure test user exists

### Test Fixtures

- `createTestFixture()` - Create complete test environment (org, tenant, unit, product)
- `createMinimalFixture()` - Create minimal test environment (just org)

## 📊 Test Data Management

### Automatic Cleanup

Tests automatically clean up created data using `afterAll` hooks:

```typescript
test.afterAll(async () => {
  await fixture.cleanup(); // Removes all created resources
});
```

### Test User

A default test user is created automatically:
- **Email:** `test@example.com`
- **Password:** `Test123!@#`

The `ensureTestUser()` helper will register this user if it doesn't exist.

## 🎯 Best Practices

1. **Always Clean Up**: Use `afterAll` hooks to clean up test data
2. **Use Fixtures**: Use `createTestFixture()` for complex test scenarios
3. **Wait for Backend**: Use `waitForBackend()` before running tests
4. **Isolate Tests**: Each test should be independent
5. **Use Real Data**: Tests should use real backend API, not mocks

## 🔍 Debugging Tests

### Playwright Debug Mode

```bash
npx playwright test --debug
```

This opens Playwright Inspector where you can:
- Step through tests
- Inspect page state
- See network requests
- View console logs

### View Test Results

```bash
npx playwright show-report
```

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots
- Videos
- Network traces

These are saved in `test-results/` directory.

## 📝 Test Coverage

### Current Test Suites

- ✅ **Authentication** (`e2e/auth.spec.ts`)
  - Login via UI
  - Login via API
  - Logout
  - Error handling

- ✅ **Master Data** (`e2e/master-data.spec.ts`)
  - Organization CRUD
  - Tenant management
  - Search and filtering

- ✅ **Production** (`e2e/production.spec.ts`)
  - Production plans
  - Production events
  - Plan details

### Integration Tests

- ✅ **Master Data API** (`src/test/integration/master-data.integration.test.ts`)
  - API CRUD operations
  - Data validation

## 🚨 Troubleshooting

### Backend Not Ready

If tests fail with connection errors:

```bash
# Check if backend is running
curl http://localhost:4004/api/health

# Start backend manually
cd server/pro-act-backend
npm run start:dev
```

### Test User Issues

If authentication fails:

```typescript
// Ensure test user exists
await ensureTestUser('test@example.com', 'Test123!@#');
```

### Port Conflicts

If ports 4004 or 8070 are in use:

```bash
# Kill processes on ports
npx kill-port 4004 8070
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Vitest Documentation](https://vitest.dev)
- [Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/intro/)

## 🎉 Next Steps

1. Add more E2E tests for other modules
2. Add visual regression testing
3. Set up CI/CD pipeline for automated testing
4. Add performance testing
5. Add accessibility testing

