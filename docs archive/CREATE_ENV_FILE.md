# ⚠️ URGENT: Create .env File for Backend

## Problem
The backend cannot connect to the database because the `.env` file is missing or incomplete.

## Quick Fix

### Step 1: Create the .env file

Open PowerShell in the backend directory and run:

```powershell
cd server\pro-act-backend
Copy-Item env.template .env
```

### Step 2: Edit the .env file

Open `server/pro-act-backend/.env` in a text editor and update these values:

```bash
# Database Configuration - UPDATE THESE!
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=YOUR_SQL_SERVER_PASSWORD_HERE
DB_NAME=ProActDB

# Application Configuration
PORT=4004
NODE_ENV=development

# JWT Authentication - UPDATE THESE!
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-change-this-in-production-abc123
JWT_EXPIRATION=24h
JWT_REFRESH_SECRET=your-refresh-token-secret-different-from-jwt-secret-xyz789
JWT_REFRESH_EXPIRATION=7d

# Password Security
BCRYPT_ROUNDS=10

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### Step 3: Update Required Values

**CRITICAL:** Update these values with your actual configuration:

1. **DB_PASSWORD** - Replace with your SQL Server password
2. **JWT_SECRET** - Should be at least 32 characters (for security)
3. **JWT_REFRESH_SECRET** - Should be different from JWT_SECRET

### Step 4: Restart Backend

After creating/updating the `.env` file, restart the backend server:

```powershell
# Stop the current server (Ctrl+C)
# Then restart:
cd server\pro-act-backend
npm run start:dev
```

## Verify SQL Server is Running

1. Open **SQL Server Management Studio (SSMS)**
2. Connect to your SQL Server instance
3. Verify the `ProActDB` database exists
4. If not, create it:
   ```sql
   CREATE DATABASE ProActDB;
   ```

## Default Values

The code now has default values as a fallback, but you should still configure the `.env` file properly:

- Default host: `localhost`
- Default port: `1433`
- Default database: `ProActDB`
- Default username: `sa`

---

**After creating the `.env` file and restarting, the database connection error should be resolved!**

