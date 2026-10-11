# AVEVA PI Integration Guide

ProAct integrates with AVEVA PI through a **unified backend architecture**. All PI Web API calls, credential storage, event pulling, mapping, and scheduled sync run on the NestJS backend. The frontend never talks to PI directly once a connection is saved.

---

## Architecture

```
Browser (React)
    ↓ JWT
Backend API (NestJS)
    ↓ encrypted credentials
PI Web API (Event Frames, AF, Historian)
    ↓
SQL Server (pi_events, production_events, pi_connections, …)
    ↓ WebSocket
Event Hub (live refresh)
```

### Key backend modules

| Module | Purpose |
|--------|---------|
| `PIWebApiService` | All PI HTTP calls using stored tenant credentials |
| `PIEventPullService` | Pull EF, map attributes, create production events |
| `PIBrowserController` | `/api/pi-browser/:tenantId/*` — proxy browse & sync |
| `PISyncSchedulerService` | Cron every minute — runs active `pi_sync_jobs` |
| `CredentialEncryptionService` | AES-256-GCM encryption for PI passwords at rest |

---

## Setup (step-by-step)

### 1. Configure PI connection

1. Open **Connectivity → AVEVA PI → Connection**
2. Enter PI Web API URL (e.g. `https://your-pi-server/piwebapi`)
3. Enter username and password
4. Click **Test Connection** (uses backend `/api/pi-browser/:tenantId/test-connection`)
5. Click **Save Settings** — credentials are encrypted and stored in `pi_connections`

### 2. Select AF scope

1. Go to **AF Hierarchy**
2. Choose scope: **Element (Root)** or **Database**
3. Pick Asset Server → AF Database → (optional) Root Element
4. **Save AF Selection** — stored in connection `connection_config` JSON

### 3. Bind hierarchy

1. Expand AF tree
2. Bind AF elements to local **Units** or **Assets**
3. Or use **Hierarchy Mapping** (Connectivity tab) for universal PI → unit/asset mapping

### 4. Map event templates

1. Go to **Mapping** tab
2. Map PI templates to app event types:
   - `Production Loss` → `ProductionLoss`
   - `IOW Deviation` → `IOW`
   - etc.
3. Map EF attributes (Cost, Quantity, ReasonCode, …) to production event fields
4. Saved in `pi_mappings.mapping_rules` JSON

### 5. Enable auto-sync (optional)

1. Go to **Connectivity → PI Event Auto-Sync**
2. Enable sync and set interval (e.g. 15 minutes)
3. Backend cron runs jobs **even when the browser is closed**
4. Uses watermarks in `pi_sync_watermarks` for delta sync

### 6. Manual pull

- **Event Hub → Pull from PI** — one-shot backend pull
- **PI Integration → Sync** — same backend path via `PISyncService`

---

## How PI events appear in Event Hub

1. Backend pulls Event Frames from PI for the configured scope/time range
2. For each EF:
   - Fetches attributes (Cost, Quantity, ReasonCode, …)
   - Resolves unit/asset via hierarchy mapping or AF bindings
   - Maps template → event type and attributes → fields
   - Skips events with no unit binding
   - Deduplicates by `eventId` (PI WebId)
3. Creates/updates rows in `production_events` with `source = 'PI'`
4. Broadcasts `productionEventCreated` / `productionEventUpdated` via WebSocket
5. Event Hub auto-refreshes and shows events on the correct type tabs

---

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pi-browser/:tenantId/sync` | Pull & map PI events |
| POST | `/api/pi-browser/:tenantId/request` | Generic PI Web API proxy |
| GET | `/api/pi-browser/:tenantId/test-connection` | Test stored credentials |
| GET | `/api/pi-browser/:tenantId/eventframes` | List event frames |
| POST | `/api/integration/pi/pull-events` | Legacy pull endpoint |
| POST | `/api/connectivity/events/pull` | Unified pull (sourceType: PI) |
| POST | `/api/pi-sync-jobs/:id/run` | Run sync job immediately |

---

## Security

- PI passwords encrypted at rest with **AES-256-GCM**
- Set `CREDENTIAL_ENCRYPTION_KEY` in backend `.env` (32+ chars; falls back to `JWT_SECRET`)
- API responses never return raw passwords (masked as `********`)
- All endpoints require JWT authentication

---

## Validation

Run automated PI API validation:

```bash
npx playwright test e2e/pi-integration.spec.ts
```

Manual checklist:
1. Save PI connection in **Connectivity → PI Integration**
2. Enable sync in **PI Event Sync Manager** (backend cron)
3. Trigger manual sync — verify Event Hub shows new events
4. Check **Plan Dashboard → Unmapped Production Events** for frames without hierarchy mapping
5. Confirm reason/impact/OEE codes resolve to master data UUIDs on mapped events

---

When a PI Event Frame cannot be mapped to a unit/asset (no AF binding or hierarchy mapping), it is stored in **`unmapped_events`** instead of being dropped.

Each record includes:
- PI WebId (`source_id`)
- Event name, type, times
- `event_data` JSON with `reason`, `suggestions`, and full event snapshot

View unmapped events in **Production Plans → Plan Dashboard → Unmapped Production Events**.

## Code resolution

PI attributes like `ReasonCode`, `ImpactCode`, and `OEECode` are resolved to database UUIDs during pull:

1. If value is already a UUID → used as-is
2. Exact match on `code` or `name` (tenant-scoped)
3. Partial name match as fallback

Unresolved codes are omitted from the production event (logged at debug level) — the event is still created if hierarchy mapping succeeds.

---

Event Hub connects to `socket.io` on the backend and listens for:

- `productionEventCreated`
- `productionEventUpdated`
- `productionEventDeleted`

New PI-synced events appear automatically without manual refresh.

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| No events in Event Hub | Unit/asset binding, template mapping, PI EF exist in time range |
| Sync not running | `pi_sync_jobs.is_active = 1`, backend running, check job `error_message` |
| Connection failed | PI URL reachable from backend server (not browser), credentials correct |
| Duplicate events | Should not occur — dedup by `eventId`; report if seen |
| CORS errors | Should not occur — all PI calls go through backend |

---

## Environment variables (backend)

```env
CREDENTIAL_ENCRYPTION_KEY=your-32-char-minimum-encryption-key
PORT=4004
JWT_SECRET=your-jwt-secret
```

Frontend:

```env
VITE_API_BASE_URL=http://localhost:4004/api
```
