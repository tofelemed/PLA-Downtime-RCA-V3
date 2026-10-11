# 🎨 Frontend UI Testing Guide - Hierarchy Mappings

## ✅ What's Been Created

### **1. UI Component**
- **Location**: `src/components/hierarchy-mapping/HierarchyMappingManager.tsx`
- **Features**:
  - View all hierarchy mappings
  - Create new mappings (direct or pattern-based)
  - Edit existing mappings
  - Delete mappings
  - Toggle active/inactive status
  - Search and filter functionality
  - Beautiful, modern UI matching your app's design

### **2. Integration**
- **Added to**: `src/pages/Connectivity.tsx`
- **Tab Name**: "Hierarchy Mappings"
- **Access Path**: `/connectivity` → Click "Hierarchy Mappings" tab

---

## 🚀 How to Test

### **Step 1: Start Backend**
```bash
cd server/pro-act-backend
npm run start:dev
```

### **Step 2: Start Frontend**
```bash
# In a new terminal
npm run dev
```

### **Step 3: Access the UI**

1. **Open your browser**: Navigate to `http://localhost:5173` (or your frontend port)

2. **Login**: Use your credentials (SuperAdmin, OrgAdmin, or TenantAdmin role required)

3. **Navigate to Connectivity**:
   - Click on "Connectivity" in the sidebar navigation
   - Or go directly to: `http://localhost:5173/connectivity`

4. **Open Hierarchy Mappings Tab**:
   - Click on the "Hierarchy Mappings" tab at the top

---

## 📝 Creating Your First Mapping

### **Example 1: Direct Mapping (PI to Unit)**

1. Click **"Create Mapping"** button

2. Fill in the form:
   - **Source Type**: Select "PI"
   - **Target Type**: Select "Unit"
   - **Source Identifier**: Enter a PI WebId (e.g., `F1DPqQ_8kaqkDxyz`)
   - **Source Path** (optional): Enter full path (e.g., `PI\\Plant1\\Line1\\Pump1`)
   - **Target Unit**: Select a unit from dropdown
   - **Priority**: Enter `70` (higher = checked first)
   - **Pattern-based**: Leave OFF (unchecked)
   - **Active**: Leave ON (checked)
   - **Description**: "PI Element to Unit mapping"

3. Click **"Create"**

4. You should see:
   - ✅ Success toast notification
   - ✅ New mapping appears in the list

### **Example 2: Pattern-Based Mapping (PI Pattern to Asset)**

1. Click **"Create Mapping"** button

2. Fill in the form:
   - **Source Type**: Select "PI"
   - **Target Type**: Select "Asset"
   - **Pattern-based**: Turn ON (checked)
   - **Pattern**: Enter `PI\\Plant1\\Line1\\*`
   - **Target Asset**: Select an asset from dropdown
   - **Priority**: Enter `60`
   - **Description**: "All Line1 elements map to this asset"

3. Click **"Create"**

4. The pattern mapping will match any PI identifier that starts with `PI\Plant1\Line1\`

---

## 🧪 Testing Features

### **1. Search & Filter**

- **Search**: Type in the search box to filter by identifier or description
- **Source Type Filter**: Filter by PI, OPCUA, Modbus, etc.
- **Status Filter**: Show all, active only, or inactive only

### **2. Edit Mapping**

- Click the **Edit** button (pencil icon) on any mapping
- Modify the fields
- Click **"Update"** to save changes

### **3. Toggle Active/Inactive**

- Use the toggle switch on any mapping card
- Active mappings are used for event tagging
- Inactive mappings are ignored

### **4. Delete Mapping**

- Click the **Delete** button (trash icon) on any mapping
- Confirm the deletion
- Mapping will be removed from the list

### **5. Priority Testing**

- Create multiple mappings with different priorities
- Higher priority (e.g., 80) will be checked before lower priority (e.g., 50)
- This allows fine-grained control over mapping precedence

---

## 🔗 Testing Event Ingestion

After creating mappings, test that events are properly tagged:

### **Step 1: Create Mappings**
- Create at least one mapping for your test source (e.g., PI)

### **Step 2: Pull Events**
- Go to the **Integrations** tab in Connectivity
- Use PI integration to pull events
- Or use the unified event pull service

### **Step 3: Verify Tagging**
- Events should be automatically tagged with the mapped hierarchy
- Check production events to see `unitId` and `assetId` are populated

---

## 🐛 Troubleshooting

### **"No mappings found"**
- ✅ Normal if you haven't created any yet
- Click "Create First Mapping" button

### **"Failed to load hierarchy mappings"**
- Check backend is running
- Check you're logged in
- Check browser console for errors
- Verify tenant ID is set in your session

### **Can't see Units/Assets in dropdown**
- Make sure you have created units/assets in Master Data
- Refresh the page
- Check tenant selection matches your units/assets

### **Mapping not working**
- Verify mapping is **Active** (toggle switch is ON)
- Check priority is set correctly
- Verify source identifier matches exactly (case-sensitive)
- For patterns, ensure pattern syntax is correct (double backslashes)

### **Backend errors (401, 404, 500)**
- Check backend is running on correct port (usually 3000 or 4004)
- Check API base URL in frontend config
- Verify JWT token is valid (try logging out and back in)
- Check backend logs for detailed error messages

---

## 📊 UI Features Overview

### **Main View**
- ✅ List of all mappings with cards
- ✅ Search bar for filtering
- ✅ Source type filter dropdown
- ✅ Status filter (All/Active/Inactive)
- ✅ Badges showing source type, pattern type, priority
- ✅ Active/inactive status indicator
- ✅ Quick actions (Edit, Delete, Toggle)

### **Create/Edit Dialog**
- ✅ Source type selector (PI, OPCUA, Modbus, etc.)
- ✅ Target type selector (Unit, Asset, Tenant, Organization)
- ✅ Pattern-based toggle
- ✅ Source identifier or pattern input
- ✅ Source path (optional)
- ✅ Target selector (populated based on target type)
- ✅ Priority slider/input (0-100)
- ✅ Active toggle
- ✅ Description textarea
- ✅ Form validation

---

## 🎯 Quick Test Checklist

- [ ] Backend server is running
- [ ] Frontend dev server is running
- [ ] Logged in with appropriate role
- [ ] Navigated to `/connectivity`
- [ ] Clicked "Hierarchy Mappings" tab
- [ ] Can see the mapping management interface
- [ ] Created a test direct mapping
- [ ] Created a test pattern mapping
- [ ] Edited a mapping
- [ ] Deleted a mapping
- [ ] Toggled active/inactive
- [ ] Used search and filters
- [ ] Verified mappings appear in list
- [ ] Tested event ingestion with mappings

---

## 📚 Related Documentation

- **Integration Guide**: `HIERARCHY_MAPPING_INTEGRATION_COMPLETE.md`
- **Migration Guide**: `MIGRATION_COMPLETE.md`
- **System Design**: `UNIVERSAL_HIERARCHY_MAPPING_SYSTEM.md`

---

**Ready to test!** 🚀

Navigate to `/connectivity` → "Hierarchy Mappings" tab and start creating mappings!

