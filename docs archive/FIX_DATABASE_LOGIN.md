# 🔧 Fix Database Login Error

## ✅ Credentials Updated

Your `.env` file has been updated with:
- **DB_USERNAME:** `sa`
- **DB_PASSWORD:** `P@ssw0rd`
- **PORT:** `4004`

---

## ⚠️ Still Getting "Login failed for user 'sa'"?

The error indicates that SQL Server is rejecting the credentials. Here are common causes and fixes:

### 1. SQL Server Instance Name

If you're using a **named instance** (like `SQLEXPRESS`), you need to update `DB_HOST`.

**Update `.env` file:**
```env
DB_HOST=localhost\SQLEXPRESS
# OR
DB_HOST=.\SQLEXPRESS
```

### 2. Enable SQL Server Authentication

SQL Server might only allow Windows Authentication.

**Fix:**
1. Open **SQL Server Management Studio (SSMS)**
2. Connect to your SQL Server instance
3. Right-click server → **Properties** → **Security**
4. Select **"SQL Server and Windows Authentication mode"**
5. Click **OK**
6. **Restart SQL Server service**

### 3. Enable SA Account

The `sa` account might be disabled.

**Fix in SSMS:**
```sql
-- Enable sa account
ALTER LOGIN sa ENABLE;

-- Set password (if needed)
ALTER LOGIN sa WITH PASSWORD = 'P@ssw0rd';
```

Or via GUI:
1. In SSMS: **Security** → **Logins** → Right-click `sa` → **Properties**
2. Check **"Enabled"**
3. Go to **"Status"** tab → Enable login: **Grant**
4. Click **OK**

### 4. Verify SQL Server is Running

**Check in PowerShell:**
```powershell
Get-Service -Name "*SQL*" | Where-Object {$_.Status -eq "Running"}
```

**Or check services:**
- Press `Win + R` → Type `services.msc`
- Look for **SQL Server (MSSQLSERVER)** or **SQL Server (SQLEXPRESS)**
- Ensure it's **Running**

### 5. Test Connection Manually

Try connecting with SSMS:
- **Server name:** `localhost` or `localhost\SQLEXPRESS`
- **Authentication:** SQL Server Authentication
- **Login:** `sa`
- **Password:** `P@ssw0rd`

If this fails, fix SQL Server configuration first.

### 6. Check TCP/IP Protocol

**Enable TCP/IP:**
1. Open **SQL Server Configuration Manager**
2. Go to **SQL Server Network Configuration** → **Protocols for [Instance]**
3. Right-click **TCP/IP** → **Enable**
4. Restart SQL Server service

---

## 🔄 After Fixing Configuration

1. **Restart SQL Server service**
2. **Restart backend server** (stop with Ctrl+C, then restart)

---

## 📝 Quick Fix Commands

### Check SQL Server Status
```powershell
Get-Service -Name "*SQL*" | Format-Table -AutoSize
```

### Try Different Host Formats

Update `.env` with one of these and restart backend:

**Option 1: Default instance**
```env
DB_HOST=localhost
DB_PORT=1433
```

**Option 2: Named instance (SQLEXPRESS)**
```env
DB_HOST=localhost\SQLEXPRESS
DB_PORT=1433
```

**Option 3: Local named instance**
```env
DB_HOST=.\SQLEXPRESS
DB_PORT=1433
```

---

## ✅ Once Fixed, You Should See:

```
✅ Application is running on: http://localhost:4004
✅ API documentation available at: http://localhost:4004/api
```

Instead of:
```
❌ ConnectionError: Login failed for user 'sa'
```

---

**Fix SQL Server configuration, then restart the backend!** 🔄

