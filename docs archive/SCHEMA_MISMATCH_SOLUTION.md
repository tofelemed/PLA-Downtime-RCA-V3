# 🚨 Schema Mismatch Solution

## The Problem

**If the frontend requires fields that don't exist in the database:**

1. ❌ **When Creating/Updating Records:**
   - Frontend sends: `{ actual: 1000, shortRangePlan: 1200, losses: 200, action: 'Reconcile' }`
   - Backend receives the data but **CANNOT SAVE** because columns don't exist
   - Result: **Data is LOST** - fields are silently ignored or cause errors

2. ❌ **When Reading Records:**
   - Frontend expects: `loss.actual`, `loss.action`, etc.
   - Backend returns: `undefined` for these fields
   - Result: **Frontend crashes** or shows wrong/empty data

3. ❌ **Broken Functionality:**
   - Production Loss editing won't work
   - Calculations will fail
   - UI components expecting these fields will break

---

## Example: ProductionLoss

### Frontend Requires:
```typescript
interface ProductionLoss {
  actual: number;           // ❌ MISSING in DB
  shortRangePlan: number;   // ❌ MISSING in DB
  losses: number;           // ❌ MISSING in DB
  unaccountedLoss: number;  // ❌ MISSING in DB
  action: string;           // ❌ MISSING in DB ('Reconcile' | 'RCA Required' | 'Closed')
}
```

### Database Currently Has:
```sql
- loss_type, loss_category, quantity, cost, description
```

**Result:** When frontend tries to create/update a ProductionLoss, these fields will be **lost** because the database can't store them!

---

## Solution: Add Missing Columns

I've created a **migration script** that will add all missing columns to match frontend requirements.

### Migration Script:
`server/pro-act-backend/database-setup/add-missing-columns-migration.sql`

This script will:
1. ✅ Add `actual`, `short_range_plan`, `losses`, `unaccounted_loss`, `action` to `production_losses`
2. ✅ Add all missing columns to `production_events`
3. ✅ Add all missing columns to `rcas`

### To Apply the Migration:

1. **Run the migration script:**
   ```powershell
   sqlcmd -S localhost -d ProActDB -i "server/pro-act-backend/database-setup/add-missing-columns-migration.sql"
   ```

2. **Update entities** to include the new columns (I've started this)

3. **Restart backend** to pick up changes

4. **Test frontend** - all features should work now!

---

## Alternative: Temporary Workaround

If you can't run migrations right now, we can:

1. **Store extra fields in JSON column** (flexible but less queryable)
2. **Map existing fields** to frontend expectations (fragile)
3. **Make fields optional** in frontend (loses functionality)

**But the best solution is to add the columns to the database!**

