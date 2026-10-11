# 🔧 Hierarchy Mapping Setup Guide

## Issue: "No tenant ID found" Error

If you see the error **"No tenant ID found. Please ensure you are logged in with a valid tenant"**, this means your user session doesn't have a tenant assigned.

## ✅ Solution: Set Up Tenant Structure

### **Option 1: Use Data Seeding (Recommended for Testing)**

1. **Navigate to Data Seeding Page**:
   - Go to `/data-seeding` in your browser
   - Or click "Data Seeding" in the sidebar navigation

2. **Seed Sample Data**:
   - Click "Seed Oil & Gas Data" or "Seed Cement Industry Data"
   - This will create:
     - Organizations
     - Tenants
     - Units
     - Assets
     - Production Plans
     - Other master data

3. **Refresh the Page**:
   - After seeding, refresh the Hierarchy Mappings page
   - Your tenant should now be available

### **Option 2: Create Tenant Manually**

1. **Navigate to Master Data**:
   - Go to `/master-data`
   - Click on "Organizations & Tenants" tab

2. **Create Organization** (if not exists):
   - Click "Create Organization"
   - Fill in name, code, description
   - Save

3. **Create Tenant**:
   - Click "Create Tenant"
   - Fill in name, code, description
   - Select the organization you just created
   - Save

4. **Assign Tenant to User**:
   - The tenant should automatically be associated with your user if you're a SuperAdmin or OrgAdmin
   - If not, contact your administrator

### **Option 3: Use Existing Tenant**

If tenants already exist but you don't have one assigned:

1. **Check Available Tenants**:
   - Go to Master Data → Organizations & Tenants
   - See what tenants exist

2. **Contact Administrator**:
   - Ask them to assign a tenant to your user account
   - Or log in as a SuperAdmin to assign it yourself

---

## 🚀 After Tenant is Set Up: Seed Test Mappings

Once you have a tenant ID:

1. **Go to Hierarchy Mappings**:
   - Navigate to `/connectivity` → "Hierarchy Mappings" tab

2. **Click "Seed Test Data" Button**:
   - This will create 10+ sample mappings for testing
   - Includes mappings for:
     - PI (direct and pattern)
     - OPC UA
     - Modbus
     - MQTT
     - Database
     - REST API
     - Universal wildcard

3. **Verify Mappings**:
   - You should see a list of mappings
   - Each mapping shows:
     - Source Type (PI, OPCUA, etc.)
     - Source Identifier/Pattern
     - Target (Unit, Asset, Tenant, Organization)
     - Priority
     - Active Status

---

## 📋 Test Mappings Created by Seeder

The seeder creates the following test mappings:

1. **Direct PI Mapping** (Priority: 90)
   - Maps specific PI WebId to Unit
   - High priority for exact matches

2. **Pattern PI Mapping** (Priority: 70)
   - Maps all PI elements under `PI\Plant1\Line1\*` to Unit
   - Medium priority for pattern matches

3. **Direct PI to Asset** (Priority: 85)
   - Maps specific PI element to Asset

4. **OPC UA Direct** (Priority: 80)
   - Maps OPC UA node ID to Unit

5. **OPC UA Pattern** (Priority: 65)
   - Maps all OPC UA nodes under Line2 to Unit 2

6. **Modbus Mapping** (Priority: 75)
   - Maps Modbus register to Asset

7. **MQTT Topic** (Priority: 70)
   - Maps MQTT topic to Unit

8. **Database Mapping** (Priority: 30)
   - Maps database connection to Tenant level

9. **REST API Pattern** (Priority: 60)
   - Maps REST API endpoint pattern to Unit

10. **Universal Wildcard** (Priority: 10)
    - Fallback mapping for all unmatched sources

---

## 🧪 Testing the Mappings

After seeding test data:

1. **View Mappings**:
   - All mappings should appear in the list
   - Filter by source type or status

2. **Test Event Ingestion**:
   - Go to Event Hub or PI Integration
   - Pull events from external sources
   - Events should be automatically tagged with hierarchy based on mappings

3. **Test Mapping Priority**:
   - Higher priority mappings are checked first
   - If a direct mapping (priority 90) matches, pattern mappings won't be checked

4. **Create Custom Mappings**:
   - Click "Create Mapping" to add your own mappings
   - Test with real source identifiers from your systems

---

## 🔍 Troubleshooting

### **Still Seeing "No tenant ID" Error?**

1. **Check Browser Console**:
   - Open DevTools (F12)
   - Check console for session details
   - Look for: `session?.tenant?.id`

2. **Check Network Tab**:
   - Look for API calls to `/api/auth/profile`
   - Verify tenant ID is in the response

3. **Try Logging Out and Back In**:
   - Logout completely
   - Clear browser localStorage
   - Login again with a user that has a tenant

4. **Verify User Has Tenant**:
   - As SuperAdmin, go to User Management
   - Check if your user has a tenant assigned
   - Assign one if missing

---

## 📚 Related Documentation

- **FRONTEND_UI_TESTING_GUIDE.md** - Complete UI testing guide
- **TROUBLESHOOTING_LOADING_ISSUE.md** - Debug loading problems
- **UNIVERSAL_HIERARCHY_MAPPING_SYSTEM.md** - System design documentation

---

**Ready to test!** Once you have a tenant, click "Seed Test Data" to get started! 🚀

