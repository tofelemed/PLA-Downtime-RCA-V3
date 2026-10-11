# Test Environment Setup - Complete ✅

## Overview
A complete test environment has been set up with master data for the **Oil & Gas Industry (ADNOC)**.

## Created Test User

**Login Credentials:**
- **Email:** `test@proact.com`
- **Password:** `Test123!@#`
- **Role:** `SuperAdmin`

## Master Data Created

### Organization
- **Name:** ADNOC (Abu Dhabi National Oil Company)
- **Code:** ADNOC-001
- **Description:** Test Organization for Oil & Gas operations

### Tenant
- **Name:** ADNOC Onshore
- **Code:** ADNOC-ONSHORE-001
- **Description:** ADNOC Onshore Operations - Test Tenant

### Production Units (4 units)
1. **Crude Distillation Unit 1** (CDU-001)
   - Capacity: 150,000 BBL/day
   - Description: Main crude distillation unit for oil processing

2. **Hydrocracker Unit** (HCU-001)
   - Capacity: 80,000 BBL/day
   - Description: Hydrocracking unit for heavy oil processing

3. **Fluid Catalytic Cracker** (FCC-001)
   - Capacity: 120,000 BBL/day
   - Description: FCC unit for gasoline production

4. **Reformer Unit** (REF-001)
   - Capacity: 60,000 BBL/day
   - Description: Catalytic reformer for octane enhancement

### Assets (4 assets for CDU-001)
1. Main Distillation Column (CDU-COL-001) - High Criticality
2. Crude Oil Feed Pump (CDU-PUMP-001) - High Criticality
3. Heat Exchanger E-101 (CDU-HE-101) - Medium Criticality
4. Furnace F-101 (CDU-FURN-101) - High Criticality

### Products (7 products)
1. **Arab Light Crude** (ALC) - BBL
2. **Arab Medium Crude** (AMC) - BBL
3. **Murban Crude** (MUR) - BBL
4. **Premium Gasoline 95** (MOGAS-95) - BBL
5. **Diesel Fuel EN590** (DIESEL-EN590) - BBL
6. **Jet Fuel Jet A-1** (JETA1) - BBL
7. **Heavy Fuel Oil 380** (HFO-380) - MT

### Master Data Codes

#### Impact Codes (3)
- **QTY-LOSS:** Quantity Loss - Cost: $5,000/hour
- **AVAIL-LOSS:** Availability Loss - Cost: $3,000/hour
- **PERF-LOSS:** Performance Loss - Cost: $2,000/hour

#### OEE Codes (2)
- **PLANNED:** Planned Downtime
- **UNPLANNED:** Unplanned Downtime

## Testing PI Event Pulling

### Prerequisites
1. A PI connection must be configured in the Connectivity page
2. PI mappings must be set up to map PI templates to production event types
3. AF bindings must be configured to map PI elements to units/assets

### Steps to Test Event Pulling

1. **Login to Frontend:**
   - Navigate to `http://localhost:8070`
   - Login with: `test@proact.com` / `Test123!@#`

2. **Configure PI Connection:**
   - Go to **Connectivity** page
   - Create a new PI connection with:
     - PI Web API URL
     - Username and Password
     - Database Web ID or Element Web ID
   - Save the connection

3. **Configure PI Mappings:**
   - Go to **PI Integration** settings
   - Create mappings between PI event frame templates and production event types
   - Example: Map "Equipment Failure" template to "Unplanned Downtime" event type

4. **Configure AF Bindings:**
   - Map PI Asset Framework elements to your units/assets
   - Example: Map PI element "CDU-001" to unit "Crude Distillation Unit 1"

5. **Pull Events:**
   - Navigate to **EventHub** page
   - Click the **"Pull from PI"** button
   - Events will be fetched from PI and automatically created as production events
   - Check the EventHub list to see the pulled events

### API Endpoint for Event Pulling

You can also pull events programmatically using the API:

```bash
POST /api/connectivity/events/pull
Authorization: Bearer <token>
Content-Type: application/json

{
  "sourceType": "PI",
  "sourceId": "<pi-connection-id>",
  "tenantId": "<tenant-id>",
  "startTimeUtc": "2025-12-16T00:00:00Z",
  "endTimeUtc": "2025-12-16T23:59:59Z",
  "maxCount": 50,
  "autoCreateProductionEvents": true,
  "filters": {
    "scopeType": "database",
    "scopeId": "<database-web-id>"
  }
}
```

## Running the Setup Script

To re-run the setup script (it will reuse existing data if found):

```bash
cd server/pro-act-backend
npm run setup:test-env
```

## Database Status

Check database status:
```bash
cd server/pro-act-backend
npx ts-node scripts/check-database-status.ts
```

## Next Steps

1. ✅ Test user created
2. ✅ Master data (organizations, tenants, units, assets, products) created
3. ✅ Master data codes (impact codes, OEE codes) created
4. ⏭️ Configure PI connection (if you have access to a PI system)
5. ⏭️ Test event pulling from PI
6. ⏭️ Create production plans and events
7. ⏭️ Test RCA investigations

## Notes

- The setup script is idempotent - it will reuse existing data if found
- All data is created for the "ADNOC Onshore" tenant
- The test user has SuperAdmin role with full access
- PI event pulling requires a configured PI connection and mappings

