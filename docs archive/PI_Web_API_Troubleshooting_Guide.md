# PI Web API 500 Internal Server Error - Troubleshooting Guide

## **Error Description**
```
GET http://localhost:8070/piwebapi/assetdatabases/{databaseWebId}/eventframes?startTime=...&endTime=...&sortField=StartTime&sortOrder=Ascending&maxCount=1
500 (Internal Server Error)
```

## **What This Error Means**
A **500 Internal Server Error** indicates that the PI Web API server encountered an unexpected error while processing your request. This is a **server-side error**, not a problem with your frontend code.

## **Immediate Troubleshooting Steps**

### 1. **Check PI Web API Service Status**
```bash
# Windows (PowerShell as Administrator)
Get-Service -Name "PI Web API*"

# Check if service is running
Get-Service -Name "PI Web API*" | Select-Object Name, Status, StartType
```

### 2. **Test Basic PI Web API Connectivity**
```bash
# Test basic endpoint
curl -k https://your-pi-server:443/piwebapi/system/status

# Test health endpoint
curl -k https://your-pi-server:443/piwebapi/system/health

# Test asset servers endpoint
curl -k https://your-pi-server:443/piwebapi/assetservers
```

### 3. **Check PI Web API Logs**
**Location**: `C:\Program Files\OSIsoft\PI Web API\logs\`

**Key files to check**:
- `PIWebAPI.log` - Main application log
- `PIWebAPI_Error.log` - Error-specific log
- `PIWebAPI_Trace.log` - Detailed trace log

**Look for**:
- Authentication errors
- Database connection failures
- Permission denied errors
- Configuration issues

## **Common Causes & Solutions**

### **Cause 1: PI Web API Service Down**
**Symptoms**: All PI Web API endpoints return errors
**Solution**:
```bash
# Restart PI Web API service
Restart-Service -Name "PI Web API*"

# Check service dependencies
Get-Service -Name "PI Web API*" | Get-ServiceDependency
```

### **Cause 2: Database Connection Issues**
**Symptoms**: Specific database endpoints fail
**Solution**:
1. **Check PI Data Archive service**:
   ```bash
   Get-Service -Name "PI Data Archive*"
   ```

2. **Verify database connectivity**:
   ```bash
   # Test from PI Web API server
   ping your-pi-server
   telnet your-pi-server 5450
   ```

3. **Check database permissions**:
   - Verify PI Web API service account has access to PI Data Archive
   - Check if database is online and accessible

### **Cause 3: Authentication/Authorization Issues**
**Symptoms**: 401/403 errors, or 500 errors with auth problems
**Solution**:
1. **Check PI Web API configuration**:
   ```xml
   <!-- Check C:\Program Files\OSIsoft\PI Web API\web.config -->
   <authentication>
     <anonymousAuthentication enabled="false" />
     <windowsAuthentication enabled="true" />
   </authentication>
   ```

2. **Verify service account**:
   - PI Web API service should run under a domain account
   - Account must have access to PI Data Archive
   - Account must have access to AF databases

### **Cause 4: Event Frames Database Issues**
**Symptoms**: Only event frames endpoints fail
**Solution**:
1. **Check if Event Frames are enabled**:
   - PI Web API may not support Event Frames for this database
   - Database may not have Event Frames configured

2. **Verify Event Frames permissions**:
   - User must have read access to Event Frames
   - Database must support Event Frames feature

### **Cause 5: Configuration Issues**
**Symptoms**: Intermittent 500 errors
**Solution**:
1. **Check web.config**:
   ```xml
   <!-- Verify connection strings -->
   <connectionStrings>
     <add name="PIWebAPI" connectionString="..." />
   </connectionStrings>
   ```

2. **Check appsettings.json**:
   ```json
   {
     "PIWebAPI": {
       "MaxRequestLength": 1048576,
       "RequestTimeout": "00:05:00"
     }
   }
   ```

## **Advanced Troubleshooting**

### **Enable Detailed Logging**
1. **Edit web.config**:
   ```xml
   <system.web>
     <compilation debug="true" />
   </system.web>
   ```

2. **Enable trace logging**:
   ```xml
   <system.web>
     <trace enabled="true" pageOutput="false" />
   </system.web>
   ```

### **Check Windows Event Logs**
1. **Open Event Viewer**
2. **Navigate to**: Windows Logs > Application
3. **Look for**:
   - PI Web API errors
   - .NET Framework errors
   - IIS errors

### **Test with PI Web API Test Tool**
1. **Download PI Web API Test Tool** from OSIsoft
2. **Test the failing endpoint** with different parameters
3. **Compare results** with your application

## **Frontend Error Handling Improvements**

### **Enhanced Error Messages**
```typescript
if (error.status === 500) {
  errorTitle = 'PI Server Error';
  errorMessage = 'PI Web API server returned an internal error. This usually indicates a server-side issue. Please check your PI server status and try again later.';
}
```

### **Retry Logic**
```typescript
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 500 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      throw error;
    }
  }
};
```

## **Prevention Strategies**

### **1. Health Checks**
- Implement regular PI Web API health checks
- Monitor service status
- Set up alerts for service failures

### **2. Connection Pooling**
- Use connection pooling for database connections
- Implement circuit breaker pattern
- Add timeout handling

### **3. Graceful Degradation**
- Handle PI Web API failures gracefully
- Provide fallback data sources
- Show user-friendly error messages

## **Getting Help**

### **OSIsoft Support**
- **Support Portal**: https://support.osisoft.com
- **Documentation**: https://docs.osisoft.com
- **Community**: https://community.osisoft.com

### **Information to Provide**
When contacting support, include:
1. **Error details**: Full error message and stack trace
2. **PI Web API version**: Check in web.config or system info
3. **PI Data Archive version**: Current version number
4. **Log files**: Relevant log entries
5. **Configuration**: web.config and appsettings.json
6. **Steps to reproduce**: Exact sequence of actions

### **Escalation Path**
1. **Check logs** and basic connectivity
2. **Restart services** if appropriate
3. **Verify configuration** and permissions
4. **Contact system administrator** for server access
5. **Open support ticket** with OSIsoft

## **Quick Reference Commands**

```bash
# Check PI Web API service
Get-Service -Name "PI Web API*"

# Restart service
Restart-Service -Name "PI Web API*"

# Check service dependencies
Get-Service -Name "PI Web API*" | Get-ServiceDependency

# Test connectivity
curl -k https://your-pi-server:443/piwebapi/system/status

# Check logs
Get-Content "C:\Program Files\OSIsoft\PI Web API\logs\PIWebAPI.log" -Tail 50
```

## **Summary**
A 500 Internal Server Error from PI Web API indicates a server-side issue that requires investigation of:
- Service status
- Database connectivity
- Authentication/authorization
- Configuration
- Logs and event viewer

Use the diagnostic tools provided in the application to identify the specific issue, then follow the appropriate troubleshooting steps above.
