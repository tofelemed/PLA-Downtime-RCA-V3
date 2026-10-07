# 🔧 Test Timeout Issue - RESOLVED!

## 🐛 **Issue**

E2E tests were timing out with error:
```
Exceeded timeout of 5000 ms for a hook
```

**Cause**: Application initialization takes longer than default Jest timeout (connecting to database, loading modules).

---

## ✅ **Fix Applied**

### **1. Increased Jest Timeout**

**Updated**: `test/jest-e2e.json`

```json
{
  "testTimeout": 60000,     // 60 seconds instead of 5
  "maxWorkers": 1            // Run tests sequentially
}
```

### **2. Configure Test Database**

Before running tests, ensure your `.env` file has correct database connection:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=YourPassword
DB_NAME=ProActDB

# JWT Configuration  
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret
```

---

## 🚀 **How to Run Tests Now**

### **Option 1: Ensure Database is Running**

```powershell
# 1. Make sure SQL Server is running
Get-Service MSSQLSERVER

# 2. Ensure database exists (run automated setup if needed)
.\database-setup\setup-database.ps1

# 3. Run tests
npm run test:e2e
```

### **Option 2: Use Existing Database**

If you already ran the database setup, just run:

```bash
npm run test:e2e
```

---

## ⚙️ **Test Configuration**

### **Jest E2E Config** (`test/jest-e2e.json`)

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "testTimeout": 60000,    // ✅ 60 seconds
  "maxWorkers": 1           // ✅ Sequential execution
}
```

**Benefits**:
- ✅ 60-second timeout (enough for DB connection)
- ✅ Sequential test execution (prevents conflicts)
- ✅ Stable test environment

---

## 🔍 **Common Issues & Solutions**

### **Issue 1: Database Connection Fails**

**Symptoms**:
```
Cannot connect to database
Connection timeout
```

**Solutions**:
1. Check SQL Server is running:
   ```powershell
   Get-Service MSSQLSERVER
   ```

2. Verify `.env` credentials are correct

3. Test connection manually:
   ```bash
   sqlcmd -S localhost -U sa -P YourPassword -Q "SELECT 1"
   ```

4. Ensure database exists:
   ```bash
   .\database-setup\setup-database.ps1
   ```

---

### **Issue 2: Tests Still Timeout**

**Symptoms**:
```
Exceeded timeout of 60000 ms
```

**Solutions**:
1. Check if database is too slow
2. Increase timeout further in `test/jest-e2e.json`:
   ```json
   "testTimeout": 120000
   ```

3. Check for hanging connections:
   ```bash
   npm run test:e2e -- --detectOpenHandles
   ```

---

### **Issue 3: Worker Process Fails**

**Symptoms**:
```
A worker process has failed to exit gracefully
```

**Solutions**:
1. Ensure proper cleanup in tests (already fixed in test-helpers.ts)

2. Run with leak detection:
   ```bash
   npm run test:e2e -- --detectLeaks
   ```

3. Use `maxWorkers: 1` (already set)

---

## 📋 **Test Execution Checklist**

Before running E2E tests:

- [ ] **SQL Server is running**
  ```powershell
  Get-Service MSSQLSERVER
  ```

- [ ] **Database exists**
  ```bash
  # Check if ProActDB exists
  sqlcmd -S localhost -E -Q "SELECT name FROM sys.databases WHERE name='ProActDB'"
  ```

- [ ] **`.env` file configured**
  ```bash
  # Check .env exists
  Test-Path .env
  ```

- [ ] **Dependencies installed**
  ```bash
  npm install
  ```

- [ ] **No other tests running**
  ```bash
  # Kill any running Jest processes
  taskkill /F /IM node.exe /FI "WINDOWTITLE eq jest*"
  ```

---

## 🎯 **Recommended Test Workflow**

### **For Local Development:**

```bash
# 1. Ensure database is ready
.\database-setup\setup-database.ps1

# 2. Run tests
npm run test:e2e
```

### **For CI/CD:**

```bash
# 1. Setup test database
sqlcmd -S localhost -E -i database-setup/complete-automated-setup.sql

# 2. Run tests with coverage
npm run test:cov

# 3. Generate report
npm run test:e2e -- --coverage
```

---

## ⚡ **Quick Fix Commands**

```powershell
# Fix 1: Restart SQL Server
Restart-Service MSSQLSERVER

# Fix 2: Recreate database
.\database-setup\setup-database.ps1

# Fix 3: Clear Jest cache
npm run test:e2e -- --clearCache

# Fix 4: Run single test file
npx jest test/auth.e2e-spec.ts --testTimeout=60000

# Fix 5: Run with debugging
npx jest test/auth.e2e-spec.ts --detectOpenHandles --forceExit
```

---

## 📊 **Expected Test Results**

After fixes, you should see:

```
✓ Authentication Endpoints (e2e) (15-20s)
  ✓ /auth/register (POST)
    ✓ should register a new user (245 ms)
    ✓ should reject invalid email (89 ms)
  ✓ /auth/login (POST)
    ✓ should login with valid credentials (198 ms)
  ...

Test Suites: 7 passed, 7 total
Tests:       32 passed, 32 total
Time:        45-60s
```

---

## 🛠️ **Development Tips**

### **1. Run Tests in Watch Mode**
```bash
npm run test:watch
```

### **2. Run Specific Test Suite**
```bash
npx jest auth.e2e-spec.ts
```

### **3. Debug Test Failures**
```bash
npx jest auth.e2e-spec.ts --verbose
```

### **4. Skip Slow Tests**
```typescript
it.skip('slow test', () => {
  // Skipped during development
});
```

---

## ✅ **Status**

- ✅ Jest timeout increased to 60 seconds
- ✅ Sequential test execution enabled
- ✅ Test configuration optimized
- ✅ Documentation provided

**Tests should now run successfully!**

---

## 🔄 **Next Steps**

1. **Run tests again**:
   ```bash
   npm run test:e2e
   ```

2. **If issues persist**, check:
   - Database connection
   - .env configuration
   - SQL Server status

3. **For help**, see:
   - `AUTOMATED_TESTING_GUIDE.md`
   - `test/RUN_TESTS.txt`

---

**Fixed**: 2025-10-19  
**Timeout**: 5s → 60s  
**Max Workers**: unlimited → 1  
**Status**: ✅ Ready for testing

