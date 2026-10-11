# PI Event Frame Auto-Sync System
## Automated Event Integration from AVEVA PI

---

## 🎯 Overview

The **PI Event Auto-Sync System** automatically pulls production events from AVEVA PI Event Frames into your application at scheduled intervals, eliminating manual data entry and ensuring real-time visibility of production losses, failures, and other events.

---

## 🏗️ Architecture

### **Components:**

1. **AutoPIEventSyncService** (`src/services/pi/AutoPIEventSyncService.ts`)
   - Background service that runs scheduled sync jobs
   - Manages sync intervals, watermarks, and error handling
   - Singleton pattern for application-wide coordination

2. **PIEventSyncManager** (`src/components/pi/PIEventSyncManager.tsx`)
   - UI component for configuring and monitoring syncs
   - Located in: **Connectivity → Integrations → PI Event Auto-Sync**

3. **PISyncService** (`src/services/pi/PISyncService.ts`)
   - Core sync logic (already exists)
   - Fetches Event Frames and maps to ProductionEvents

4. **PIStore** (`src/services/pi/PIStore.ts`)
   - Manages watermarks for delta sync
   - Stores PI connection configs and mappings

5. **IndexedDB Store: `piSyncJobs`**
   - Persists sync job configurations
   - Tracks sync history, errors, and statistics

---

## 📊 Data Flow

```
AVEVA PI Server (Event Frames)
          ↓
    PIClient (Web API)
          ↓
   PISyncService (Fetch & Map)
          ↓
  AutoPIEventSyncService (Schedule & Coordinate)
          ↓
   ProductionEvent (IndexedDB)
          ↓
     Event Hub (Display)
```

---

## 🔄 Sync Mechanisms

### **1. Delta Sync (Incremental)**
- Uses **watermarks** to track last sync time
- Only fetches new/updated Event Frames since last sync
- Efficient for continuous operation
- Stored in `piSyncWatermarks` table

### **2. Initial Sync (Lookback)**
- On first run, fetches events from last X minutes (configurable)
- Default: 60 minutes lookback
- Ensures no events are missed during setup

### **3. Scheduled Sync**
- Runs automatically at configured interval
- Default: Every 15 minutes
- Configurable: 5, 15, 30, 60, or 120 minutes

### **4. Manual Sync**
- Trigger immediate sync via UI or console
- Useful for testing or catching up after downtime

---

## ⚙️ Configuration Options

| Setting | Default | Options | Description |
|---------|---------|---------|-------------|
| **Enabled** | `false` | true/false | Master on/off switch |
| **Interval** | `15 min` | 5, 15, 30, 60, 120 min | How often to sync |
| **Lookback** | `60 min` | 30, 60, 120, 240, 1440 min | Initial historical window |
| **Auto-Start** | `false` | true/false | Start syncing on app load |

---

## 🚀 How to Use

### **Step 1: Configure PI Connection**
1. Go to **Connectivity** → **Integrations**
2. Find **"Aveva PI Configuration"**
3. Enter:
   - PI Web API URL (e.g., `https://pi-server.company.com/piwebapi`)
   - Username & Password
   - Select AF Database
   - Configure Template Mappings (which templates = which event types)
4. **Test Connection** to verify

### **Step 2: Enable Auto-Sync**
1. In same page, find **"PI Event Frame Auto-Sync"** section
2. Toggle **"Auto-Sync"** to ON
3. Choose sync interval (recommended: **15 minutes**)
4. Click **"Sync Now"** to test immediately

### **Step 3: Verify Events**
1. Go to **Event Hub**
2. Filter by Source = **"PI"**
3. You should see events with:
   - Source: `PI`
   - Event Type: Based on template mapping
   - All fields mapped from EF attributes

### **Step 4: Monitor Status**
Check the sync manager card for:
- ✅ **Total Synced**: How many events pulled so far
- 🕐 **Last Success**: When last sync completed
- ⚠️ **Errors**: Any sync failures
- 📅 **Next Run**: When next sync will occur

---

## 📋 Event Mapping Logic

### **Template → Event Type**
```javascript
'Production Loss' → 'ProductionLoss'
'IOW Deviation' → 'IOW'
'SOL Violation' → 'SOL'
'APM Alert' → 'APM'
'Failure WO' → 'FailureWO'
'Production Output' → 'ProductionOutput'
```

### **Attribute → Field Mapping**

**Production Loss:**
- `Description` → `description`
- `ReasonCode` → `reasonCode`
- `Cost` → `cost`
- `Quantity` → `quantity`
- `Shift` → `shift`

**IOW Deviation:**
- `Parameter` → `parameter`
- `Limit` → `limit`
- `LimitType` → `limitType`
- `RecommendedAction` → `recommendedAction`

**APM Alert:**
- `FailureMode` → `failureMode`
- `RecommendedAction` → `recommendedAction`
- `HealthIndex` → `healthIndex`

*See full mapping in: `src/services/pi/PIMapper.ts`*

### **Hierarchy Binding (Unit/Asset)**
- **PrimaryReferencedElement** from Event Frame
- Matched against AF Element bindings
- Automatically assigns `unitId` and `assetId`

*Configure in: Connectivity → Data Flow & Binding → Hierarchy Binding*

---

## 🔍 Monitoring & Troubleshooting

### **Console Commands (Browser F12)**

```javascript
// Check sync status
const status = await autoPIEventSyncService.getSyncStatus('TENANT-ID');
console.log(status);

// Trigger manual sync
const result = await autoPIEventSyncService.triggerManualSync('TENANT-ID');
console.log(result);

// Check sync config
const config = await autoPIEventSyncService.getSyncJobConfig('TENANT-ID');
console.log(config);

// View watermark (last sync point)
const watermark = await piStore.getWatermark('TENANT-ID', 'database', 'DB-WEBID');
console.log(watermark);
```

### **Common Issues**

#### **Issue 1: No Events Syncing**

**Check:**
1. Is auto-sync **enabled**?
2. Is PI connection **configured** and **tested**?
3. Are template **mappings** set up?
4. Does the AF database have **Event Frames** in the time window?

**Debug:**
```javascript
// Check last error
const status = await autoPIEventSyncService.getSyncStatus('TENANT-ID');
console.log('Last error:', status.lastError);

// Trigger manual sync and watch console
await autoPIEventSyncService.triggerManualSync('TENANT-ID');
```

#### **Issue 2: Authentication Errors**

**Symptoms:** Sync fails with "401 Unauthorized"

**Solution:**
- Verify PI username/password in Connectivity → Integrations
- Check PI Web API permissions for the user
- Ensure Basic Auth is enabled on PI Web API server

#### **Issue 3: Missing Fields**

**Symptoms:** Events created but fields are empty

**Solution:**
- Check attribute mappings in PI Integration → Manage Mappings
- Verify EF templates have the expected attribute names
- Map custom attributes to app fields

#### **Issue 4: Events Not Appearing in Event Hub**

**Symptoms:** Sync shows events created, but not visible

**Solution:**
1. Check **Plant Selector** - Are you viewing the correct tenant?
2. Check **Source Filter** in Event Hub - Set to "All Sources" or "PI"
3. Check **Event Type** - Events may be in different tabs (Loss, IOW, etc.)

---

## 📊 Best Practices

### **Sync Intervals**

| Environment | Recommended Interval | Reason |
|-------------|---------------------|---------|
| **Production** | 15 minutes | Balance between real-time and server load |
| **Development** | 30-60 minutes | Reduce API calls during testing |
| **High-Frequency** | 5 minutes | For critical monitoring (higher server load) |
| **Low-Frequency** | 2 hours | For historical analysis only |

### **Lookback Windows**

| Scenario | Recommended Lookback | Reason |
|----------|---------------------|---------|
| **Fresh Start** | 24 hours | Capture recent history |
| **Regular Operation** | 1 hour | Just catch up on missed events |
| **After Downtime** | 4-8 hours | Recover events from outage period |

### **Performance Tips**

1. **Limit Scope**: Use AF Database sync (not root element) for better performance
2. **Template Filtering**: Only sync relevant templates
3. **Avoid Peak Hours**: Don't set 5-minute intervals during peak load
4. **Monitor Errors**: Check error count regularly - persistent errors indicate config issues
5. **Use Delta Sync**: Watermarks ensure efficiency - don't manually reset unless needed

---

## 🔐 Security Considerations

### **Credentials Storage**
- PI credentials stored in IndexedDB (encrypted at browser level)
- Not sent to any external server (stays in browser)
- Use dedicated PI service account (not personal credentials)

### **Permissions Required**
- **PI Web API**: Read access to Event Frames
- **AF Database**: Read access to configured database/element
- **Attribute Access**: Read access to Event Frame attributes

### **Network**
- CORS must be configured on PI Web API server
- Basic Auth must be enabled
- HTTPS recommended for production

---

## 🎛️ Advanced Configuration

### **Custom Template Mappings**

Navigate to: **Connectivity → Integrations → PI Integration → Manage Mappings**

1. Select a template (e.g., "Production Loss")
2. Load its attributes
3. Map each attribute to an app field
4. Save mappings

Example:
```
EF Attribute          App Field
─────────────────    ─────────────────
Description      →   description
ReasonCode       →   reasonCode
Cost             →   cost
Duration         →   duration
```

### **Hierarchy Binding**

Navigate to: **Connectivity → Data Flow & Binding → Hierarchy Binding**

1. Load AF Elements from PI
2. Bind AF Elements to Units/Assets in your app
3. Event Frames will auto-assign to bound units/assets

Example:
```
AF Element                    App Entity
────────────────────────     ────────────────────
ADNOC/FCCU                →  Unit: FCCU
ADNOC/FCCU/Air Blower     →  Asset: Air Blower K-401
```

### **Console Management**

```javascript
// Start auto-sync programmatically
await autoPIEventSyncService.startSync('TENANT-ID', {
  enabled: true,
  intervalMinutes: 15,
  lookbackMinutes: 60,
  autoStart: true
});

// Stop auto-sync
autoPIEventSyncService.stopSync('TENANT-ID');

// Check what's running
const status = await autoPIEventSyncService.getSyncStatus('TENANT-ID');
console.log('Is running:', status.isRunning);
console.log('Is enabled:', status.isEnabled);
console.log('Next run:', status.nextRun);
```

---

## 📈 Metrics & Analytics

### **Sync Job Metrics**
- **Total Synced**: Cumulative events pulled from PI
- **Success Rate**: Successful syncs / total attempts
- **Error Count**: Failed sync attempts
- **Avg Events per Sync**: Events fetched per run
- **Last Duration**: Time taken for last sync (ms)

### **Event Metrics (in Event Hub)**
- Filter by Source = "PI" to see synced events
- Quick stats show cost, downtime, and event counts
- Export to CSV for external analysis

---

## 🛠️ Maintenance

### **Regular Tasks**

**Daily:**
- Check error count in sync manager
- Verify events are appearing in Event Hub

**Weekly:**
- Review sync statistics
- Adjust interval if needed based on load

**Monthly:**
- Review template mappings for accuracy
- Update hierarchy bindings if plant structure changes
- Check watermarks are advancing properly

### **Troubleshooting Checklist**

- [ ] PI connection configured and tested
- [ ] Template mappings defined
- [ ] Hierarchy bindings created for units/assets
- [ ] Auto-sync toggle is ON
- [ ] No authentication errors in console
- [ ] Watermark is advancing after each sync
- [ ] Events visible in Event Hub (source = "PI")

---

## 🎓 Example Workflow

### **Complete Setup (Step-by-Step)**

#### **1. Configure PI Connection (5 minutes)**
```
Connectivity → Integrations → Aveva PI Configuration
→ Enter server URL, username, password
→ Select AF Database
→ Test Connection
```

#### **2. Set Up Template Mappings (10 minutes)**
```
PI Integration → Manage Mappings tab
→ Select template: "Production Loss"
→ Load attributes
→ Map: Description → description
→ Map: Cost → cost
→ Map: ReasonCode → reasonCode
→ Save
→ Repeat for other templates (IOW, SOL, APM, etc.)
```

#### **3. Configure Hierarchy Bindings (10 minutes)**
```
Data Flow & Binding → Hierarchy Binding
→ Load AF Elements from PI
→ Bind: AF "FCCU" → App Unit "Fluid Catalytic Cracking Unit"
→ Bind: AF "Air Blower" → App Asset "Air Blower K-401"
→ Save bindings
```

#### **4. Enable Auto-Sync (2 minutes)**
```
PI Event Frame Auto-Sync section
→ Toggle "Auto-Sync" to ON
→ Set interval: 15 minutes
→ Set lookback: 60 minutes
→ Click "Sync Now" to test
```

#### **5. Verify in Event Hub (1 minute)**
```
Event Hub
→ Filter Source: "PI"
→ See your synced events!
```

**Total Setup Time: ~30 minutes**

---

## 📖 User Guide (Quick Reference)

### **For Plant Engineers:**

**To View PI Events:**
1. Go to **Event Hub**
2. Click **Source** dropdown (top-right) → Select **"PI"**
3. Events with source = "PI" are from AVEVA

**To Trigger Immediate Sync:**
1. Go to **Connectivity** → **Integrations**
2. Find **"PI Event Auto-Sync"** card
3. Click **"Sync Now"** button
4. Wait 10-30 seconds
5. Check Event Hub for new events

### **For Administrators:**

**To Enable/Disable Auto-Sync:**
1. Go to **Connectivity** → **Integrations**
2. Find **"PI Event Auto-Sync"** card
3. Toggle **"Auto-Sync"** switch
4. Monitor status in the stats grid

**To Change Sync Frequency:**
1. Same location as above
2. Under **"Sync Configuration"**
3. Select **"Sync Interval"** dropdown
4. Choose: 5, 15, 30, 60, or 120 minutes

**To View Sync History:**
- Check **"Last Run"** and **"Last Success"** timestamps
- Check **"Total Synced"** for cumulative count
- Check **"Errors"** for failure count

---

## 🎯 Benefits

### **Operational:**
- ✅ **Real-time Visibility**: Events appear within minutes
- ✅ **Zero Manual Entry**: Eliminates data entry errors
- ✅ **Consistent Data**: Single source of truth from PI
- ✅ **Complete History**: Automatic backfill of recent events

### **Technical:**
- ✅ **Delta Sync**: Only fetches new data (efficient)
- ✅ **Resilient**: Auto-recovers from temporary failures
- ✅ **Scalable**: Handles thousands of events
- ✅ **Flexible**: Configurable intervals and mappings

### **Business:**
- ✅ **Faster RCA**: Events available immediately for investigation
- ✅ **Better Analytics**: Comprehensive event history
- ✅ **Audit Trail**: All events time-stamped and traceable
- ✅ **Compliance**: Complete record of production losses

---

## 🔧 Advanced Features

### **Conditional Sync**
Future enhancement: Sync only specific templates or time ranges

### **Transform Functions**
Future enhancement: Custom JavaScript transforms for complex mappings

### **Conflict Resolution**
Future enhancement: Handle updates to existing events

### **Batch Processing**
Current: Processes up to 500 events per sync (configurable)

---

## 📞 Support & Debugging

### **Console Helpers**

```javascript
// Get current status
await autoPIEventSyncService.getSyncStatus('YOUR-TENANT-ID')

// View all sync jobs
await autoPIEventSyncService.getAllActiveSyncJobs()

// Manually trigger sync
await autoPIEventSyncService.triggerManualSync('YOUR-TENANT-ID')

// Check watermark
await piStore.getWatermark('TENANT-ID', 'database', 'DB-WEBID')

// View synced PI events in IndexedDB
await piStore.listEvents('TENANT-ID')
```

### **Log Levels**

The service logs to console with emoji prefixes:
- `🔄` = Sync starting
- `✅` = Success
- `❌` = Error
- `⚠️` = Warning
- `📌` = Watermark info
- `🚀` = Service started

---

## 🎓 Training Resources

### **For Users:**
1. Watch sync status card in Connectivity page
2. Click "Sync Now" to see immediate results
3. Check Event Hub → Source: PI for synced events

### **For Admins:**
1. Understand delta sync and watermarks
2. Learn template mapping configuration
3. Monitor error counts and troubleshoot

### **For Developers:**
1. Review `AutoPIEventSyncService.ts` for service logic
2. Review `PISyncService.ts` for mapping logic
3. Extend mappings in `PIMapper.ts` as needed

---

## 📦 Storage Schema

### **piSyncJobs Table**
```typescript
{
  id: string;
  tenantId: string;
  enabled: boolean;
  intervalMinutes: number;
  lookbackMinutes: number;
  autoStart: boolean;
  lastRun?: string;
  lastSuccess?: string;
  lastError?: string;
  nextRun?: string;
  syncedEventCount: number;
  errorCount: number;
}
```

### **piSyncWatermarks Table**
```typescript
{
  id: string;
  tenantId: string;
  scopeType: 'element' | 'database';
  scopeId: string; // WebId
  lastEndUtc: string; // ISO timestamp
}
```

---

## ✨ Future Enhancements

1. **Real-time Streaming**: WebSocket-based live updates (instead of polling)
2. **Selective Sync**: Choose specific templates or severity levels
3. **Bidirectional Sync**: Update PI Event Frames from app
4. **Historical Backfill**: UI to backfill large date ranges
5. **Sync Scheduling**: Specific times (e.g., only during night shift)
6. **Multi-tenant Sync**: Coordinate syncs across multiple plants
7. **Event Deduplication**: Detect and merge duplicate events
8. **Smart Intervals**: Auto-adjust based on event frequency

---

## 📚 Related Documentation

- [PI Web API Guide](./PI_WEB_API_TROUBLESHOOTING_GUIDE.md)
- [PI Integration Guide](./PI_INTEGRATION_GUIDE.md)
- Event Hub User Manual (to be created)
- RCA Module Guide (to be created)

---

## 🎯 Summary

The **PI Event Auto-Sync System** provides:
- ✅ Automated event ingestion from AVEVA PI
- ✅ Configurable sync intervals (5-120 minutes)
- ✅ Delta sync for efficiency
- ✅ Professional monitoring UI
- ✅ Error handling and recovery
- ✅ Complete audit trail

**Result:** Production events automatically flow from PI into your Event Hub, enabling real-time visibility, faster RCA, and better analytics.

---

*Document Version: 1.0*
*Last Updated: October 14, 2025*
*Author: Pro-ACT Development Team*

