## AVEVA PI Integration – How it works and how to test (step‑by‑step)

This guide explains how the PI integration works in this frontend (IndexedDB‑first) architecture, and how to test it thoroughly. It is written for non‑technical users as well; every step is explicit.

### 1) What this integration does (overview)
- Connects to PI Web API using Basic Auth.
- Browses AF hierarchy and binds AF elements to your Units/Assets in the app.
- Fetches Event Frames (EF) by time window and scope (AF Element/Root or AF Database).
- Maps EF templates/attributes to app events (ProductionLoss, IOW, SOL, APM, FailureWO, ProductionOutput).
- Stores EF and mappings locally (IndexedDB), and creates app events (source = PI).
- Supports pagination, caching, and delta sync so you don’t pull everything at once.

### 2) Where to find the PI module
- Open the app.
- Go to: Connectivity → AVEVA PI.
- Tabs you will use:
  - Connection
  - AF Hierarchy
  - Event Frames (Preview)
  - Mapping (friendly, no JSON)
  - Explorer
  - Sync & Status

### 3) Prerequisites
1. A PI Web API base URL your browser can reach. Example: `https://piv.hillal-intl.com:8070/piwebapi`
2. A PI user with permissions to list Asset Servers, AF Databases, Elements, and Event Frames.
3. For development, the app uses a dev proxy so the browser can call `/piwebapi/*` without CORS issues.
4. Know whether you want to fetch EF under an AF Element (root) or directly from an AF Database.

### 4) One‑time setup – Connection
1. Go to Connectivity → AVEVA PI → Connection.
2. Enter Base URL (e.g., `https://host:port/piwebapi`).
3. Enter Username (e.g., `DOMAIN\user`).
4. Enter Password.
5. Click “Test Connection”.
   - Expected: “PI Connection OK” and a count of Asset Servers.
6. Click “Save Settings”.
   - This stores credentials (DEV ONLY), base URL, and later your AF picks in IndexedDB.

Notes:
- Credentials are stored locally for development convenience only. In production, move auth to a backend.
- If a Windows authentication prompt appears, ensure you always access PI endpoints with Authorization headers (the module handles this); avoid opening PI URLs directly in the browser without headers.

### 5) Pick scope – AF Hierarchy
You can fetch EF by Element (Root) or by Database.
1. Go to AF Hierarchy tab.
2. In “Scope”, choose:
   - Element (Root) – typical when you have a known AF root for an organization.
   - Database – useful when EF are defined under the database (no single root).
3. Pick Asset Server.
4. Pick AF Database.
5. If “Element (Root)” scope: choose a Root Element.
6. Click “Save AF Selection”.

Optional (but recommended): Bind AF nodes
1. Expand the root.
2. For any AF element that corresponds to a Unit or an Asset in your app, click “Bind as Unit” or “Bind as Asset”.
3. Enter your local Unit/Asset ID.
4. A green badge will show “bound as unit → <id>” or “bound as asset → <id>”.

Why bind?
- When EF are converted to app events, the module uses the EF’s primary referenced element to look up a Unit/Asset ID. Events without a bound Unit are skipped to avoid orphaned data.

### 6) Explore Event Frames quickly
Use the Explorer to understand your templates and attributes.
1. Go to Explorer tab.
2. Choose Scope (Element or Database).
3. Set a reasonable time window (start/end).
4. Click “Scan EF”.
   - The table shows EF grouped by Template, with counts and a sample of attribute names per template.
5. If many EF exist, click “Load more” to fetch the next page of results.

Tip: Use a small time window first (e.g., last 1–24 hours) to learn which templates matter.

### 7) Configure Mapping (friendly, no JSON)
1. Go to Mapping tab.
2. Each template is shown as a collapsible panel.
3. For each relevant template (e.g., “Motor Downtime”, “Rotary Kiln Inlet Pressure High”):
   - Select an Event Type (e.g., ProductionLoss, IOW).
   - Click “Load attributes” to fetch attribute names for that template in your current scope/time.
   - For each EF Attribute shown, choose an App Field from the dropdown (e.g., Description → description, Quantity → quantity, Limit → limit, etc.).
4. For EFs without a template, use the special template “*NoTemplate*”.
5. Click “Save Mappings”.

Notes:
- You can map only the attributes you care about; others can remain “—”.
- You can revisit and change mappings anytime.

### 8) Preview Event Frames (with pagination and caching)
1. Go to Event Frames tab.
2. Choose Template:
   - “All templates” – broader (slower); better after you narrow time range.
   - A specific template – faster.
   - “*NoTemplate*” – shows EFs without a template.
3. Choose Scope (Element or Database).
4. Set Start (UTC ISO) and End (UTC ISO). Prefer narrower ranges to load faster.
5. Click “Load”.
   - The table shows 10 EF per page.
   - Use Prev / 1 / 2 / 3 / Next to navigate.
   - Pages are cached per query; moving back and forth is instant once loaded.

### 9) Create events – Sync & Status
Backfill (one‑time larger window)
1. Go to Sync & Status tab.
2. Set Start/End.
3. Click “Backfill Range”.
   - This pulls EF, stores them in IndexedDB, maps them to app events (source = PI), and updates a watermark.

Delta sync (ongoing small windows)
1. Click “Delta Sync (from last watermark)”.
   - This fetches EF only after the last end time synced.
2. Optionally enable “Auto delta sync” and choose an interval (e.g., 300 sec) to keep the local cache hot.

Status
- The top cards show total EF stored, counts by template, and the last watermark time.

### 10) View events in EventHub
1. Go to EventHub.
2. Set Source filter to “PI”.
3. Optionally select a PI Template to filter further.
4. Click a row to view details.
5. Use “Open in PI” to open the EF in PI Web API.

### 11) Recommended testing plan (end‑to‑end)
Connectivity
1. Enter Base URL, Username, Password; Test Connection; Save.

AF scope and binding
2. Choose Scope (Element or Database), Asset Server, AF Database; if Element scope, select Root; Save AF Selection.
3. Expand tree; bind at least one Unit and one Asset; confirm badges appear.

Explore EF
4. Explorer: set 1–24h window; Scan EF; confirm templates and attribute samples display.

Mapping
5. Mapping: for at least two templates (e.g., a downtime and a parameter high template):
   - Set Event Type (ProductionLoss or IOW/SOL/APM).
   - Load attributes; map Description, Quantity/Cost (for losses) or Parameter/Limit/LimitType (for IOW/SOL).
   - Save Mappings.

Preview EF
6. Event Frames: choose template → Load; navigate pages; confirm performance improved as you page and cache warms up.

Sync
7. Sync & Status: Backfill a small window first (e.g., last 1–2h) → confirm fetched/created counts.
8. Delta Sync → run twice; the second run should fetch 0 or very few if no new EF.
9. Enable Auto delta sync; wait for one interval; confirm stats update.

EventHub
10. EventHub: Source = PI; verify events appear under correct type tabs.
11. Open an event; confirm Unit/Asset and mapped fields are populated.
12. Click “Open in PI” and verify it opens the EF (requires PI session/permissions).

Edge cases
13. No template EF: use “*NoTemplate*” mapping; rerun Backfill for a small window; confirm events created.
14. Database scope with no root: set Scope=Database, run Preview and Backfill; confirm it works.
15. Orphan EF (no binding): unbind the element and Backfill; confirm such EF do not create app events.

Maintenance
16. Change mappings; re‑run Delta; confirm new fields populate for new EF only (existing events won’t retro‑update unless resynced).
17. Clear local cache (for a fresh test):
   - In your browser DevTools → Application/Storage → Clear site data OR
   - Delete IndexedDB database `ProActDB` and reload the app.

### 12) Performance tips
- Start with short time windows (1–24h) and a single template.
- Use database scope only when needed; element scope with a root reduces the EF search space.
- Pagination (10 per page) + caching avoids re‑fetching; we also prefetch the next page.
- For best performance at scale, move to a backend index (Postgres/ClickHouse + API) and let the UI query that instead of PI directly.

### 13) Security notes
- Credentials in this frontend are DEV‑ONLY. For production:
  - Use a backend proxy for PI Web API calls and store secrets in a secure vault.
  - Add auditing for mapping and sync actions.

### 14) Troubleshooting
- Windows auth dialog appears repeatedly:
  - Ensure you saved credentials and re‑opened PI tabs so all calls contain Authorization headers.
  - Avoid opening `https://.../piwebapi/...` directly in the browser without auth.
- “No results”:
  - Check time window, scope selection, and template filters.
  - Reduce time range and try again.
- “Bind failed” or missing events:
  - Ensure AF element of the EF’s primary element is bound to a Unit/Asset.
- Slow loads:
  - Narrow time window; pick a specific template; rely on pagination; consider backend indexing for large datasets.

### 15) What’s stored locally (for reference)
- `piConnections`: base URL, creds (dev only), selected server/db, auto delta settings.
- `piAfElements`: optional AF element cache.
- `afBindings`: AF webId ↔ app Unit/Asset ID.
- `piEvents`: EF copies (id = EF webId) with attributes and tenantId.
- `piMappings`: template → event type and EF attribute → app field.
- `piSyncWatermarks`: last synced time per scope (element or database).

You’re ready. Follow the steps in order, and you’ll get fast, reliable PI ingestion into your APM app.

