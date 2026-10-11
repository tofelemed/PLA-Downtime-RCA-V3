# Running E2E Tests in Headed Mode

## Interactive Test Execution

To see the tests running in the browser, use one of these commands:

### Option 1: Playwright UI Mode (Recommended)
```bash
npm run test:e2e:ui
```
This opens an interactive UI where you can:
- See all tests
- Run individual tests
- Watch tests execute in real-time
- See screenshots and videos
- Debug failures

### Option 2: Headed Mode (See Browser)
```bash
npm run test:e2e -- --headed
```
Runs all tests with visible browser windows.

### Option 3: Headed Mode with Slower Execution
```bash
npm run test:e2e -- --headed --slow-mo=1000
```
Runs tests with 1 second delay between actions (easier to watch).

### Option 4: Run Specific Test File in Headed Mode
```bash
npm run test:e2e -- e2e/auth.spec.ts --headed
```

### Option 5: Debug Mode (Step Through)
```bash
npm run test:e2e:debug
```
Opens Playwright Inspector for step-by-step debugging.

## Test Files

- `e2e/auth.spec.ts` - Authentication tests (4 tests)
- `e2e/master-data.spec.ts` - Master data management tests (5 tests)
- `e2e/production.spec.ts` - Production module tests (4 tests)

## Current Test Status

- ✅ **Authentication**: 4/4 tests passing
- ⚠️ **Master Data**: 0/5 tests (UI visibility issues)
- ⚠️ **Production**: 1/4 tests (form interaction issues)

## Notes

- Tests use real backend data via API
- Test fixtures create organizations, tenants, units, and products
- All test data is cleaned up after tests complete
- Backend and frontend servers start automatically

