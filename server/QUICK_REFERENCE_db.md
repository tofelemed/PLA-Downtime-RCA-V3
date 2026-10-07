# Database Migration Quick Reference

**One-page cheat sheet for Pro-Act IndexedDB → PostgreSQL migration**

---

## 📊 Database Structure at a Glance

### 52 Tables in 8 Categories
```
Core (5)          → organizations, tenants, users, units, assets
Codes (5)         → impact_codes, oee_codes, rca_cause_codes, verification_status_codes, reason_codes
Production (8)    → products, plans, plan_templates, events, losses, oee_summaries, reconcile_forms, loss_categories
RCA Core (6)      → rcas, rca_recommendations, rca_evidence, logic_tree_nodes, rca_templates, rca_knowledge_base
RCA Tools (8)     → 5why, fishbone, fmea, fault_tree, barrier, change analyses + configs
PI Integration (9)→ pi_connections, pi_af_elements, af_bindings, pi_events, pi_mappings, sync_watermarks, sync_jobs, historian_tags, data_sources
Config (7)        → custom_attributes, dashboard_configs, app_settings, evidence_categories/locations, connection_configs
Audit (2)         → audit_logs, unmapped_events
```

---

## 🔑 Common Patterns

### Every Table Has
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
deleted_at TIMESTAMP WITH TIME ZONE  -- Soft delete
```

### Multi-Tenancy
```
Organization (1) → (N) Tenant → (N) Unit → (N) Asset
                    ↓
            tenant_id on most tables
```

### Foreign Keys
```sql
ON DELETE CASCADE   -- Parent-child (tenant → units)
ON DELETE SET NULL  -- References (event → asset)
ON DELETE RESTRICT  -- Master data (plan → product)
```

---

## 🔄 Data Transformation

### Case Conversion
```typescript
// Frontend → Database
camelCase → snake_case
eventId → event_id
startTime → start_time

// Database → Frontend  
snake_case → camelCase
event_id → eventId
start_time → startTime
```

### Date Handling
```typescript
// IndexedDB stores as ISO strings
"2025-10-16T10:30:00.000Z"

// PostgreSQL: TIMESTAMP WITH TIME ZONE
TIMESTAMP '2025-10-16 10:30:00+00'
```

---

## 📝 Key Tables Reference

### production_events (All 7 Event Types)
```sql
event_type: ProductionLoss | IOW | SOL | APM | FailureWO | ProductionOutput

-- Common fields
id, event_id, unit_id, asset_id, description, start_time, end_time, status

-- Type-specific fields
ProductionLoss: plan_id, quantity, cost, impact_code_id, oee_code_id
IOW:           parameter, value, limit_value, limit_type, breach_duration
SOL:           sol_type, parameter, value, limit_value, breach_duration
APM:           apm_type, severity, recommended_action
FailureWO:     work_order_id, failure_mode, cost
ProductionOutput: plan_id, quantity
```

### rcas (Root Cause Analysis)
```sql
status: Draft | In Progress | Analysis | Published | Closed
priority: Low | Medium | High | Critical

Key fields:
- event_id (FK to production_events)
- team_lead_id, team_member_ids[]
- root_cause, recommendations (JSONB)
- timeline tracking fields
- effectiveness metrics
```

### production_plans
```sql
status: Planned | Active | Completed | Cancelled
approval_status: Draft | Pending Review | Pending Approval | Approved | Rejected

Key fields:
- unit_id, product_id
- planned_quantity, actual_quantity
- start_date, end_date
- approval workflow fields
- custom_attributes (JSONB)
```

---

## 🚀 Migration Flow

### 1. Export from IndexedDB
```typescript
const data = await storageService.query('production_events');
```

### 2. Transform
```typescript
const transformed = data.map(toSnakeCase);
```

### 3. Validate
```typescript
const errors = DataValidator.validateRequired(item, ['event_id', 'unit_id']);
```

### 4. Insert
```typescript
await apiClient.post('/events', transformed);
```

### 5. Verify
```typescript
const validation = await validateMigration(tables);
```

---

## 🔍 Essential Indexes

### High-Traffic Queries
```sql
-- Events by unit and time
CREATE INDEX idx_events_time_search 
ON production_events(unit_id, start_time DESC) 
WHERE deleted_at IS NULL;

-- Events by type and status
CREATE INDEX idx_events_dashboard 
ON production_events(tenant_id, event_type, status) 
WHERE deleted_at IS NULL;

-- RCA by status
CREATE INDEX idx_rcas_status 
ON rcas(tenant_id, status) 
WHERE deleted_at IS NULL;
```

### JSONB Searches
```sql
CREATE INDEX idx_plans_custom_attrs 
ON production_plans USING GIN (custom_attributes);
```

### Full-Text Search
```sql
CREATE INDEX idx_events_description_fts 
ON production_events USING GIN (to_tsvector('english', description));
```

---

## 🛠️ Common SQL Queries

### Get Active Events for Unit
```sql
SELECT * FROM production_events
WHERE unit_id = $1
  AND deleted_at IS NULL
  AND status IN ('Open', 'In Progress', 'RCA Required')
ORDER BY start_time DESC;
```

### Get RCAs with Evidence Count
```sql
SELECT r.*, COUNT(e.id) as evidence_count
FROM rcas r
LEFT JOIN rca_evidence e ON r.id = e.rca_id AND e.deleted_at IS NULL
WHERE r.tenant_id = $1 AND r.deleted_at IS NULL
GROUP BY r.id;
```

### Get Production Plan with Events
```sql
SELECT 
  p.*,
  COUNT(e.id) as event_count,
  SUM(e.cost) as total_cost
FROM production_plans p
LEFT JOIN production_events e ON p.id = e.plan_id AND e.deleted_at IS NULL
WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
GROUP BY p.id;
```

---

## 🔒 Security Checklist

### Row-Level Security
```sql
ALTER TABLE production_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON production_events
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### API Authentication
```typescript
headers: {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
}
```

### Sensitive Data
```sql
-- Encrypt in application before storing
password_hash: bcrypt or argon2
api_keys: AES-256 encryption
```

---

## 📡 API Endpoints Quick List

```
# Core CRUD
GET    /api/v1/{resource}
POST   /api/v1/{resource}
GET    /api/v1/{resource}/{id}
PUT    /api/v1/{resource}/{id}
DELETE /api/v1/{resource}/{id}

# Common Resources
/organizations
/tenants
/units
/assets
/events
/plans
/rcas
/impact-codes
/oee-codes

# Bulk Operations
POST /api/v1/bulk/events
POST /api/v1/migration/{table}

# Analytics
GET /api/v1/tenants/{id}/reports/oee
GET /api/v1/tenants/{id}/reports/dashboard
```

---

## ⚡ Performance Tips

### Connection Pooling
```typescript
pool: {
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000
}
```

### Batch Inserts
```sql
-- Use COPY for bulk data (fastest)
COPY production_events FROM '/path/to/data.csv' CSV;

-- Or prepared statement with VALUES
INSERT INTO events (id, event_id, ...) VALUES
  ($1, $2, ...), ($3, $4, ...), ... -- batch of 100-1000
```

### Query Optimization
```sql
-- Always use EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM production_events WHERE unit_id = 'xxx';

-- Look for:
Seq Scan → Add index
High cost → Optimize query
```

---

## 🧪 Testing Commands

### Validate Migration
```typescript
const results = await validateMigration([
  { tableName: 'productionEvents', apiEndpoint: 'events' },
  { tableName: 'rcas', apiEndpoint: 'rcas' }
]);
```

### Test API Connection
```bash
curl http://localhost:3000/api/v1/health
```

### Check Record Counts
```sql
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

---

## 🔄 Dual-Write Mode

### Enable
```typescript
import { hybridStorageService } from '@/services/HybridStorageService';
hybridStorageService.setMode('dual'); // Write to both IndexedDB and API
```

### Switch to API Only
```typescript
hybridStorageService.setMode('backend'); // API only
```

### Rollback
```typescript
hybridStorageService.setMode('indexeddb'); // IndexedDB only
```

---

## 📋 Migration Checklist

### Before
- [ ] Back up IndexedDB data (export to JSON)
- [ ] Set up PostgreSQL database
- [ ] Run `schema-complete.sql`
- [ ] Implement backend API
- [ ] Test on sample data

### During
- [ ] Run migration scripts
- [ ] Monitor progress (logs)
- [ ] Validate each batch
- [ ] Handle errors

### After
- [ ] Validate data integrity
- [ ] Check record counts
- [ ] Test application functionality
- [ ] Enable dual-write
- [ ] Monitor for 1-2 weeks

---

## 🚨 Common Issues & Solutions

### Issue: Foreign Key Violations
**Solution**: Migrate in dependency order (organizations → tenants → units → assets → events)

### Issue: Date Format Mismatch
**Solution**: Use ISO 8601 format: `new Date().toISOString()`

### Issue: Case Sensitivity
**Solution**: Use case conversion utilities consistently

### Issue: NULL vs Empty String
**Solution**: Decide on convention (prefer NULL for missing data)

### Issue: JSONB Queries Slow
**Solution**: Add GIN index on JSONB columns

---

## 📞 Quick Help

| Problem | Document | Section |
|---------|----------|---------|
| Schema details | DATABASE_SCHEMA_MIGRATION_GUIDE.md | Part 3 |
| Migration code | MIGRATION_IMPLEMENTATION_GUIDE.md | Part 2 |
| API design | DATABASE_SCHEMA_MIGRATION_GUIDE.md | Part 7 |
| SQL syntax | schema-complete.sql | Complete file |
| Validation | MIGRATION_IMPLEMENTATION_GUIDE.md | Part 5 |

---

## 🎯 Success Metrics

- ✅ Zero data loss
- ✅ All foreign keys valid
- ✅ Query response < 100ms
- ✅ API uptime > 99.9%
- ✅ Zero critical bugs

---

**Print this page for quick reference during migration! 📄**

