# Remaining Database Column Mapping Issues

## Current Status

✅ **Fixed:**
- `updatedAt` column mappings for production_events, rcas, production_losses
- App Settings JSON serialization (working - returns 201 OK)

❌ **Still Failing:**
1. Production Events: `Invalid column name 'productivityImprovement'`
2. RCAs: `Invalid column name 'reasonCodeId'`  
3. Production Losses: `Invalid column name 'tenantId'` (FIXED in code but needs verification)

## Root Cause

The database uses **snake_case** column names (e.g., `tenant_id`, `reason_code_id`, `productivity_improvement`) but the entities use **camelCase** property names without explicit column mappings.

## Required Fixes

### 1. Production Events Entity
The error mentions `productivityImprovement` which is actually in the RCA entity. This suggests TypeORM is trying to load related RCA fields when querying production events.

**Action Needed:** Ensure RCA entity fields have explicit column mappings.

### 2. RCAs Entity  
The error mentions `reasonCodeId` which is in ProductionEvent entity. This suggests when loading RCAs with `relations: ['event']`, TypeORM tries to access ProductionEvent fields.

**Action Needed:** 
- ✅ Already fixed `reasonCodeId` column mapping in production-event.entity.ts
- Need to verify RCA entity doesn't try to access non-existent fields

### 3. Production Losses Entity
The error mentions `tenantId` needs to map to `tenant_id`.

**Action Needed:**
- ✅ Already fixed tenantId column mapping
- May need to restart backend to pick up changes

## Next Steps

1. **Restart backend** to ensure all column mapping fixes are loaded
2. **Verify** the actual database schema matches entity definitions
3. **Add explicit column mappings** for all camelCase fields that map to snake_case database columns

## Database Schema Reference

From `database-setup/complete-automated-setup.sql`:

**production_events** uses:
- `tenant_id`, `organization_id`, `unit_id`, `event_type`, `start_time`, `end_time`, `impact_code_id`, `reason_code_id`, etc.

**rcas** uses:  
- `tenant_id`, `organization_id`, `event_id`, `team_lead_id`, `team_members`, etc.

**production_losses** uses:
- `tenant_id`, `organization_id`, `plan_id`, etc.

All use **snake_case** naming convention.

