# Pro-Act cutover runbook (v1 → v2, plan 3.10)

Step-by-step migration, cutover and rollback for one pilot scope (a tenant = a plant). Spec MIG01–MIG06, §18.2; decisions D11 (no destructive reset), C4 (v1 screens stay behind flags until pilot acceptance), A5 (pilot plant HDPE, units unit100–unit500). Evidence of the dev dry run: `plans/evidence/cutover-dry-run.md`.

**Rules that hold in every step**
- Nothing is deleted from a v1 table. Rollback is a flag switch, never a delete; the before → after report fails if a legacy table lost rows.
- Every tool is a dry run unless it gets `--apply --actor "<your name>" --confirm-database <database>`; the database name must be the one the script is connected to.
- Every applied step writes a `migration_reports` row plus a before / after trail (`migration_changes`); `remediate.ts --revert <reportId>` undoes exactly that step and refuses when a row moved since or a review item was already decided.
- v1 screens and routes are not deleted or disabled by this runbook. Retiring them is a later, separate release (section 8).

## 1. Tools

All commands run from `server/pro-act-backend` and use the database in that folder's `.env` (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`). Override for one command with `$env:DB_NAME = 'proact_staging'` (PowerShell) or `DB_NAME=proact_staging` (bash).

| Command | Writes? | Purpose |
|---|---|---|
| `npx ts-node scripts/cutover/report.ts --out <file.md> --snapshot-out <file.json> [--tenant <uuid>] [--units unit100,unit200] [--before <file.json>] [--strict]` | never (READ ONLY transaction) | Before / after report: tenants, flags, freeze, pilot units, row inventory, dry run of every remediation job, follow-ups of earlier phases, MIG04 comparison; with `--before` the row-count diff. `--strict` exits 2 when the MIG04 gate fails or a legacy table lost rows. |
| `npx ts-node scripts/cutover/remediate.ts --job <name\|all> [--tenant <uuid>]` | with `--apply …` | §18.2 remediation jobs (below). |
| `npx ts-node scripts/cutover/remediate.ts --revert <reportId> --apply --actor … --confirm-database …` | yes | Undo one applied run (remediation or cutover step). |
| `npx ts-node scripts/cutover/cutover.ts freeze\|release --tenant <uuid> [--reason "…"]` | with `--apply …` | MIG05 v1 write freeze: every v1 POST / PUT / PATCH / DELETE of the tenant answers **423 `LEGACY_WRITES_FROZEN`**; `/api/v2/*` and `/api/auth/*` stay writable. |
| `npx ts-node scripts/cutover/cutover.ts flags-on\|flags-off --tenant <uuid> --screens all\|<key,key>` | with `--apply …` | Switch v2 screens in the cutover order (on) or its reverse (off). |
| `npx ts-node scripts/cutover/cutover.ts explain --tenant <uuid> --metric <m> --scope-key <k> --legacy <v1> --v2 <v2> --category formula_change\|quality_change\|defect --note "…"` | with `--apply …` | Record why one MIG04 difference exists (explains exactly that pair of values). |
| `npx ts-node scripts/report-event-backfill.ts` | never | Plan 1.1 backfill report (`backfill-0002.md`). |

Remediation jobs (run order of `--job all`):

| Job | Changes source rows? | What it does |
|---|---|---|
| `references` | `production_events.tenant_id`, `production_plans.tenant_id` | Missing / invalid tenant → tenant that owns the unit; no evidence or conflicting evidence → review item. Never a default tenant. |
| `sentinels` | `production_events.end_time / legacy_end_sentinel / physical_state` | PI 9999 end written after 1.1 → open interval, raw kept. |
| `durations` | no | Legacy durations of unknown unit, or PI minutes disagreeing with timestamps → review. |
| `duplicates` | no | Same tenant / source / business id: identical → canonical + crosswalk `duplicate_of` + "merge pending" review; differing → conflict review. The merge itself is done with the v2 merge operation after acceptance. |
| `legacy-values` | no (inserts) | v1 losses, reconcile amounts, loss categories, OEE → `legacy_reported_values`, `method = UnknownLegacy`. |
| `links` | no (inserts) | `reconcile_forms.productionEvent` that is a valid same-tenant event id → crosswalk `explains_event`; else review. |
| `periods` | no (inserts) | v1 period label → candidate production periods (crosswalk `period_day` / `period_instant`); ambiguous → review. |
| `reason-tree` | no | Reports the tree; no approved tree file yet (D11 Q3), so nothing is imported. Tenant-less codes → review. |
| `rates` | no | `products.standard_rate` → review until D08 Q3 says what it means. |
| `units` | no | Products without uom, v1 costs without currency, event amounts without uom / currency → review (no mapping table yet). |

## 2. Owner decisions still open (from `plans/DECISIONS.md` "Still needed" and the 3.x risks)

| # | Decision | Blocks | Default used until answered |
|---|---|---|---|
| 1 | **D02** PI Web API details 1–12 (URL, auth, service account, AF scope of unit100–unit500, templates, sentinel, batch / limits, edit / delete behaviour, test slot, actuals tags 10–12) | 1.6 / 1.7 certification, MIG03 pilot with real PI | simulator only |
| 2 | **D09 / D10** MQTT broker and Kafka cluster endpoints and security | MQTT / Kafka part of MIG03 | not connected |
| 3 | **D08 Q3** what `products.standard_rate` is (cost per unit or production rate) | `rates` job split | flagged only |
| 4 | **FX rates** USD → IRR for the pilot window (Finance → FX rates) | valuation of pilot losses | losses unvalued for missing FX |
| 5 | **D11 Q1** is there real production data to preserve, and where (data host `E:\ProAct`)? | remediation apply on the data host | treat every environment as real (MIG01) |
| 6 | **D11 Q2 / Q3 / Q4** legacy duration unit, approved reason-tree file, old reconcile data as `UnknownLegacy` | `durations`, `reason-tree`, `legacy-values` acceptance | proposed defaults (PI minutes only; flat tree; migrate as UnknownLegacy) |
| 7 | **uom / currency mapping** of v1 products, costs and quantities | `units` job | flagged only |
| 8 | **Review items** (`migration_review`): resolve or dismiss each | remediation acceptance (D11) | stay open |
| 9 | **MIG04 differences**: accept each explanation | cutover gate | gate fails while one is unexplained |
| 10 | **D15** backup / restore target and retention | restore drill (3.12), rollback safety net | `pg_dump` before every step |
| 11 | **C4 pilot acceptance** (≥ 2 operational weeks incl. month-end, MIG03) | flag switch-over for the pilot, then v1 retirement | v1 screens stay behind flags |
| 12 | Remaining v1 admin writes after cutover (users, units, products have no v2 write screen) | whether the freeze stays after cutover | freeze only for the cutover window (section 5 step 9) |

## 3. On the data host (`E:\ProAct`) — read-only first

The repository host cannot reach the data host. Run these there (PowerShell; Windows PowerShell 5.1 `>` writes UTF-16, so use `Out-File -Encoding utf8`):

```powershell
cd E:\ProAct
git pull                                   # the build that contains plan 3.10
cd server\pro-act-backend
npm ci --legacy-peer-deps
npm run migration:show                      # pending migrations, if any (the API applies them on boot)
# 1.1 backfill report (plan 1.1 risk: must be re-run on the production-like data before cutover)
npx ts-node scripts/report-event-backfill.ts | Out-File -Encoding utf8 ..\..\plans\evidence\backfill-0002.md
# 3.10 before report (read-only) and its snapshot
npx ts-node scripts/cutover/report.ts --out ..\..\plans\evidence\cutover-before-datahost.md --snapshot-out ..\..\plans\evidence\cutover-before-datahost.json
# pilot scope only
npx ts-node scripts/cutover/report.ts --tenant <HDPE tenant uuid> --units unit100,unit200,unit300,unit400,unit500 --out ..\..\plans\evidence\cutover-pilot-datahost.md
# every remediation job, dry run, with sample row changes
npx ts-node scripts/cutover/remediate.ts --job all | Out-File -Encoding utf8 ..\..\plans\evidence\remediation-dry-run-datahost.txt
```

The report works before the 3.10 migration is applied there (it says "bookkeeping tables absent"). Applying anything on the data host waits for decision 5 and a backup.

## 4. Rehearsal on a staging copy (restore from backup first)

```powershell
docker exec proact-postgres pg_dump -U postgres -Fc proact -f /tmp/proact-before-cutover.dump      # backup (keep it)
docker exec proact-postgres psql -U postgres -c "CREATE DATABASE proact_staging"
docker exec proact-postgres pg_restore -U postgres -d proact_staging /tmp/proact-before-cutover.dump
$env:DB_NAME = 'proact_staging'
npm run migration:run
npx ts-node scripts/cutover/report.ts --out staging-before.md --snapshot-out staging-before.json
# then sections 5.4–5.8 against proact_staging with --confirm-database proact_staging
npx ts-node scripts/cutover/report.ts --before staging-before.json --out staging-after.md --strict
# rollback rehearsal: section 6, then report again with --before staging-before.json --strict
```

Record both reports in `plans/evidence/migration-report.md`. Drop `proact_staging` afterwards.

## 5. Cutover of one pilot scope (MIG05)

Pre-conditions: rehearsal green; decisions 1, 3–9 answered for the scope; pilot acceptance (C4, decision 11) signed; a fresh backup. `T` = tenant uuid of the plant, `DB` = database name.

1. **Announce** the window; operators finish open v1 edits.
2. **Pause v1 collectors before the freeze** — the v1 PI scheduler writes events directly, not through HTTP, so the freeze does not stop it: in v1 Connectivity deactivate the plant's PI sync jobs (`pi_sync_jobs`). After the freeze the v1 API cannot change them.
3. **Freeze v1 writes**: `cutover.ts freeze --tenant T --reason "cutover <plant>"` (dry run), then add `--apply --actor "<name>" --confirm-database DB`. Check: a v1 write as a plant user answers 423.
4. **Drain v2 ingestion**: in the Integration console (or `POST /api/v2/ingestion-jobs/{id}/drain`) drain every job of the plant until caught up; note the watermarks.
5. **Snapshot**: `pg_dump` (as in section 4) and `report.ts --tenant T --snapshot-out before.json --out before.md`.
6. **Final delta remediation**: `remediate.ts --job all --tenant T` (dry run, read it), then the same with `--apply --actor "<name>" --confirm-database DB`. Keep the printed report ids.
7. **Verify**: `report.ts --tenant T --before before.json --out after.md --strict`. Must exit 0: no legacy table lost rows, MIG04 gate PASS (every difference explained with `cutover.ts explain …`). Review items stay open for the data owner; they do not block unless D11 says so.
8. **Activate v2** for the scope in this order (one command `--screens all`, or screen by screen with a check after each):

   | # | Flag | v2 screen | v1 screen it replaces (kept behind the flag) | Check after the switch |
   |---|---|---|---|---|
   | 1 | `v2.codesAdmin` | `/codes-admin`, `/finance` | Master Data code lists, Admin Panel rules | codes and rules list; valuation policy approved; FX rate present |
   | 2 | `v2.integrationConsole` | `/connectivity` (v2) | v1 Connectivity | connections, jobs, quarantine visible |
   | 3 | `v2.plansProfilesCalendars` | `/planning` | Production Plans / Master Data planning fields | plan versions and calendars of the pilot units |
   | 4 | `v2.eventHub` | Event Hub (v2) | Event Hub (v1) | events of the pilot units, create / code / close |
   | 5 | `v2.downtimeAnalysis` | `/downtime-analysis` | — | drill-down of the pilot units |
   | 6 | `v2.planDashboard` | `/plans/:planId` | v1 Plan Dashboard (its v1 writes answer 410) | period grid, reconciliation draft lines |
   | 7 | `v2.plaAnalytics` | `/pla-analytics`, `/reports`, `/dashboard` | v1 PLA Analytics / Reports / Dashboard | waterfall and loss tree match `after.md` |
   | 8 | `v2.rca` | `/rca` | v1 RCA module | cases and links |

   `cutover.ts flags-on --tenant T --screens all` (dry run), then with `--apply …`.
9. **Resume**: resume the drained v2 ingestion jobs; then `cutover.ts release --tenant T --apply …` (v1 screens are hidden by the flags; the remaining v1 write routes are admin ones without a v2 screen — decision 12). Leave the v1 PI sync jobs paused: v2 ingestion is the collector now.
10. **Record** `before.md`, `after.md`, the report ids and the sign-off in `plans/evidence/migration-report.md`.

## 6. Rollback

Trigger: verification fails, a v2 screen is unusable, or the owner asks. Never delete source records; buffered source data stays in the raw store for replay.

1. `cutover.ts freeze --tenant T --apply …` if the scope is not frozen (stops writes while switching).
2. `cutover.ts flags-off --tenant T --screens all --apply …` — switches in reverse order (RCA first, codes last). Equivalent: `remediate.ts --revert <flags-on report id> --apply …`.
3. Resume the v1 PI sync jobs in v1 Connectivity; pause the v2 ingestion jobs of the plant if v2 should not collect.
4. `cutover.ts release --tenant T --apply …`.
5. Only if a remediation step itself was wrong: `remediate.ts --revert <report id> --apply …`, newest first. Reverts restore the recorded `before` values; bookkeeping rows of that run are removed; source rows are never deleted.
6. `report.ts --tenant T --before before.json --out rollback.md --strict` must show no lost rows.

## 7. Evidence to keep

`before.md` / `after.md` / `rollback.md`, the snapshots (`*.json`), the remediation and cutover report ids (`SELECT id, job, status, actor, started_at FROM migration_reports ORDER BY started_at`), open review items (`SELECT issue, count(*) FROM migration_review WHERE status = 'open' GROUP BY 1`), the MIG04 explanations and the owner's sign-off.

## 8. After pilot acceptance (contract phase, later release — not done by this runbook)

Only after two clean reconciliation cycles and the owner's go:
- Remove the v1 screens per flag (Event Hub v1, Plan Dashboard v1, PLA v1, v1 Connectivity, v1 RCA, Master Data code lists) and their write routes; compatibility views stay read-only.
- With v1 Connectivity go the legacy `new Function` user filters / transforms of `BaseConnector` (plan 3.8) and the IndexedDB users that remain in v1 paths (`PIStore`, `UniversalConnectorDB`, historian, protocol / streaming demo services; plan 3.1 / 3.7).
- `src/services/streaming/` is unused (plan 3.7); deleting it was blocked by a permission rule in that session — the owner removes it or allows the deletion.
- `app_settings` is one global table (no tenant column; it holds `plantSelection`): tenant-scoping it is plan 3.11.
- v1 code create / edit still does not write `code_versions` (plan 1.3): moot once the v1 code screens are gone; until then codings of such codes carry a null version id.
- Dropping legacy tables (`reconcile_forms`, `loss_categories`, `oee_summaries`, `production_losses`, `source_hierarchy_mappings`, `pi_sync_jobs`, …) is a separate migration with its own owner sign-off.
