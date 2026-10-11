# PI Event Auto-Sync - Quick Start Guide
## Get Events Flowing from AVEVA PI in 5 Minutes

---

## 🎯 What You're Building

**Before:** Manually enter production loss events
**After:** Events automatically pulled from PI Event Frames every 15 minutes

---

## ⚡ 5-Minute Setup

### **Step 1: Navigate to Connectivity (30 seconds)**
1. Click **"Connectivity"** in left sidebar
2. Click **"Integrations"** tab at the top

### **Step 2: Configure PI Connection (2 minutes)**
Find the **"Aveva PI Configuration"** card:

1. Click **"Connection"** tab
2. Enter PI Web API URL:
   ```
   Example: https://pi-server.company.com/piwebapi
   ```
3. Enter username & password (PI service account)
4. Click **"Test Connection"** - Should show ✅ green
5. Select your AF Database from dropdown
6. Click **"Save"**

### **Step 3: Set Up Template Mappings (1.5 minutes)**
Still in PI Configuration:

1. Click **"Mapping"** tab
2. Click **"Manage Mappings"** button
3. Select template: **"Production Loss"** (or your template name)
4. Click **"Load attributes"**
5. Map attributes:
   - `Description` → `description`
   - `Cost` → `cost`
   - `ReasonCode` → `reasonCode`
6. Click **"Save Mappings"**
7. Repeat for other templates if needed

### **Step 4: Enable Auto-Sync (1 minute)**
Find the **"PI Event Frame Auto-Sync"** card (right below PI Configuration):

1. Toggle **"Auto-Sync"** switch to **ON** ✅
2. Leave interval at **"15 minutes"** (recommended)
3. Click **"Sync Now"** to test immediately
4. Watch for success message: "Sync Complete - Fetched X events, created Y new events"

### **Step 5: Verify in Event Hub (30 seconds)**
1. Navigate to **"Event Hub"** in left sidebar
2. Look for events with **source = "PI"**
3. You should see your PI Event Frames as events!

**✅ Done! Events will now sync automatically every 15 minutes.**

---

## 🔍 Verification Checklist

After setup, verify each item:

- [ ] PI connection shows **green checkmark** ✅
- [ ] Template mappings are **saved**
- [ ] Auto-sync toggle is **ON**
- [ ] "Sync Now" button worked (no errors)
- [ ] Events appear in Event Hub with source = **"PI"**
- [ ] Stat card shows **"Total Synced: X"** (X > 0)

---

## 🎛️ What Happens Now?

### **Every 15 Minutes:**
1. System checks PI for new Event Frames
2. New Event Frames are fetched (delta sync)
3. Attributes are mapped to app fields
4. Events created in your app
5. Events appear in Event Hub
6. Stats update automatically

### **Monitor Status:**
Go to **Connectivity → Integrations** and check the **PI Event Auto-Sync** card:

```
┌─────────────────────────────────────────┐
│ PI Event Frame Auto-Sync                │
│ ✅ Active - Next run in 12 minutes      │
│                                          │
│ Total Synced: 47 | Last Success: 10:35 │
└─────────────────────────────────────────┘
```

---

## 🚨 Troubleshooting (If Events Don't Appear)

### **Issue: "Sync Now" button shows error**

**Fix:**
1. Check PI connection (green checkmark?)
2. Verify username/password are correct
3. Check AF database is selected
4. Click "Test Connection" in PI Configuration

### **Issue: Sync succeeds but 0 events created**

**Fix:**
1. Check date range - Are there Event Frames in last hour?
2. Check template mappings - Is your template mapped?
3. Check Event Hub filters - Are you viewing correct source/tab?

### **Issue: Events have missing fields**

**Fix:**
1. Go to PI Integration → Manage Mappings
2. Load attributes for your template
3. Map all relevant attributes to app fields
4. Save and re-sync

---

## 🎯 Quick Commands (Browser Console F12)

```javascript
// Check if auto-sync is running
await autoPIEventSyncService.getSyncStatus('YOUR-TENANT-ID')

// Trigger immediate sync
await autoPIEventSyncService.triggerManualSync('YOUR-TENANT-ID')

// View synced events in IndexedDB
const events = await masterDataService.getProductionEvents({});
console.log('PI events:', events.filter(e => e.source === 'PI'));
```

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ Auto-sync status shows **"Active"**
2. ✅ "Total Synced" count is **> 0**
3. ✅ Event Hub has events with **source = "PI"**
4. ✅ Events have correct fields (description, cost, etc.)
5. ✅ New PI Event Frames appear in app within 15 minutes

---

## 📞 Need Help?

### **Check These First:**
1. Browser console (F12) for error messages
2. Sync status card for "Last Error"
3. PI Integration "Sync" tab for detailed logs

### **Common Solutions:**
- **Authentication error** → Re-enter PI credentials
- **No events synced** → Check template mappings
- **Missing fields** → Review attribute mappings
- **Sync not running** → Toggle Auto-Sync OFF then ON

---

## 🎓 Next Steps

Once auto-sync is working:

1. **Explore Event Hub Filters** - Search and filter PI events
2. **Create RCAs** - Investigate critical PI events
3. **Review Analytics** - PLA Dashboard shows PI event trends
4. **Configure Alerts** - Set up notifications for critical events
5. **Refine Mappings** - Add more template mappings as needed

---

## 📊 Expected Results

### **Immediate (After "Sync Now"):**
- Events appear in Event Hub
- Source badge shows "PI"
- Event type assigned based on template
- Basic fields populated

### **After 15 Minutes:**
- First automatic sync runs
- New events since last sync appear
- Watermark advances
- "Next Run" timer counts down

### **After 1 Hour:**
- 4 automatic syncs completed
- Continuous event flow established
- Stats show growing "Total Synced" count

### **After 1 Day:**
- 96 syncs completed (if 15-minute interval)
- Complete event history from PI
- RCA investigations using real PI data
- Analytics showing PI event trends

---

**You're now ready for automated PI Event integration! 🚀**

*For detailed technical information, see: [PI_EVENT_AUTOSYNC_GUIDE.md](./PI_EVENT_AUTOSYNC_GUIDE.md)*

