# PI Web API CORS Configuration Guide

## Enable CORS on PI Web API Server

### Method 1: Using IIS Manager (GUI)

1. **Open IIS Manager** on the PI Web API server (`87.107.103.198`)

2. **Navigate to the PI Web API site:**
   - Expand the server node
   - Expand "Sites" → "Default Web Site"
   - Click on "piwebapi"

3. **Open HTTP Response Headers:**
   - Double-click "HTTP Response Headers" in the main panel

4. **Add CORS Headers:**
   Click "Add" and add each of these headers:

   | Name | Value |
   |------|-------|
   | `Access-Control-Allow-Origin` | `*` |
   | `Access-Control-Allow-Methods` | `GET, POST, PUT, DELETE, OPTIONS` |
   | `Access-Control-Allow-Headers` | `Authorization, Content-Type, Accept, X-Requested-With` |
   | `Access-Control-Allow-Credentials` | `true` |
   | `Access-Control-Max-Age` | `86400` |

5. **Click "OK"** and restart the PI Web API site

### Method 2: Using PowerShell (Automated)

Run this PowerShell script **on the PI Web API server** as Administrator:

```powershell
# Configure CORS for PI Web API
Import-Module WebAdministration

$sitePath = "IIS:\Sites\Default Web Site\piwebapi"

# Add CORS headers
Add-WebConfigurationProperty -pspath $sitePath -filter "system.webServer/httpProtocol/customHeaders" -name "." -value @{name='Access-Control-Allow-Origin';value='*'}
Add-WebConfigurationProperty -pspath $sitePath -filter "system.webServer/httpProtocol/customHeaders" -name "." -value @{name='Access-Control-Allow-Methods';value='GET, POST, PUT, DELETE, OPTIONS'}
Add-WebConfigurationProperty -pspath $sitePath -filter "system.webServer/httpProtocol/customHeaders" -name "." -value @{name='Access-Control-Allow-Headers';value='Authorization, Content-Type, Accept, X-Requested-With'}
Add-WebConfigurationProperty -pspath $sitePath -filter "system.webServer/httpProtocol/customHeaders" -name "." -value @{name='Access-Control-Allow-Credentials';value='true'}

Write-Host "CORS headers configured successfully!" -ForegroundColor Green

# Restart PI Web API application pool
Restart-WebAppPool -Name "DefaultAppPool"
Write-Host "Application pool restarted." -ForegroundColor Green
```

### Method 3: Manual web.config Edit

1. **Locate the web.config file:**
   ```
   C:\inetpub\wwwroot\piwebapi\web.config
   ```

2. **Add CORS headers** inside the `<system.webServer>` section:

```xml
<system.webServer>
  <httpProtocol>
    <customHeaders>
      <add name="Access-Control-Allow-Origin" value="*" />
      <add name="Access-Control-Allow-Methods" value="GET, POST, PUT, DELETE, OPTIONS" />
      <add name="Access-Control-Allow-Headers" value="Authorization, Content-Type, Accept, X-Requested-With" />
      <add name="Access-Control-Allow-Credentials" value="true" />
      <add name="Access-Control-Max-Age" value="86400" />
    </customHeaders>
  </httpProtocol>
</system.webServer>
```

3. **Save the file** and restart IIS or the application pool

### Security Consideration: Restrict Origin

For better security, instead of `Access-Control-Allow-Origin: *`, specify your exact origin:

```xml
<add name="Access-Control-Allow-Origin" value="http://localhost:8070" />
```

Or for multiple origins, you'll need to use a dynamic approach with URL Rewrite module or backend proxy.

## Verify CORS Configuration

After configuring CORS, test it using curl or PowerShell:

```powershell
# Test CORS preflight request
$headers = @{
    "Origin" = "http://localhost:8070"
    "Access-Control-Request-Method" = "GET"
    "Access-Control-Request-Headers" = "Authorization"
}

Invoke-WebRequest -Uri "https://87.107.103.198:7443/piwebapi/assetservers" `
    -Method OPTIONS -Headers $headers -UseBasicParsing | Select-Object -ExpandProperty Headers
```

You should see the CORS headers in the response:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With
```

## Troubleshooting

### Issue: Headers not appearing in response

**Solution:** Make sure the headers are added to the correct site/application in IIS:
- The path should be `Default Web Site\piwebapi`, not just `Default Web Site`
- Restart the IIS site after making changes

### Issue: Still getting CORS errors

**Solution:** Check if there's a `web.config` file in subdirectories that might override settings:
```powershell
Get-ChildItem -Path "C:\inetpub\wwwroot\piwebapi" -Filter "web.config" -Recurse
```

### Issue: CORS works for GET but not POST/PUT/DELETE

**Solution:** Ensure the PI Web API service account has proper permissions and that the Allow-Methods header includes all needed methods.

## Alternative: PI Web API 2019+ CORS Module

PI Web API 2019 and later versions have a built-in CORS configuration in the PI Web API Admin Utility:

1. Open **PI Web API Admin Utility**
2. Navigate to **Security** → **CORS Settings**
3. Enable CORS and add your allowed origins
4. Save and restart the service

## Next Steps

After enabling CORS:
1. Restart your development server (`npm run dev`)
2. Navigate to `/connectivity` in your app
3. Enter the PI Web API details and click "Check Now"
4. It should now connect successfully without CORS errors

