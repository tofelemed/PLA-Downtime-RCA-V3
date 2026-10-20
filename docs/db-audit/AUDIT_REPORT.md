# Pro-Act database audit: Phase 1 (read-only)

Date: 2026-10-20 · Target: `proact` on container `proact-postgres` (PostgreSQL 15.18, host port 5432) · Branch `feat/downtime-area2-b`

Every query ran as `postgres` with `default_transaction_read_only=on`. I made no DDL, DML or config changes. Statistics counters date from the unclean restart on **2026-10-19 00:02 UTC**, so "unused" means unused for roughly 30 hours.

## Environment detected

| Item | Value |
|---|---|
| Engine | PostgreSQL 15.18 (`postgres:15-alpine`), container `proact-postgres`, volume `proact-postgres-data`, restart `unless-stopped` |
| Host resources (container view) | 6 vCPU, 7.9 GB RAM (shared with Docker Desktop / WSL2) |
| ORM / migrations | TypeORM 0.3, `src/database/migrations` (131 files, 130 applied; pending: `1794240500000-DropV1RcaTables`, uncommitted work in progress) |
| Schema drift | `typeorm migration:generate --dryrun`: **"No changes in database schema were found"** |
| App pool | `pg` pool max 10 per process (API + worker = 20), `statement_timeout` 30 s, slow-query log above 500 ms; no PgBouncer |
| RLS | 166 tables `ENABLE` + `FORCE ROW LEVEL SECURITY`; each connection checkout runs `SET ROLE proact_rls_user` plus the tenant list (`tenant-session-binding.ts`) |
| Size | `proact` 63 MB, 187 tables + 2 partitioned (`raw_observations`, `measurement_samples`), 833 indexes (19 MB), 4 views, 22 functions, 87 triggers (mostly immutability guards) |
| Extensions | `plpgsql`, `uuid-ossp`, `btree_gist`. **No `pg_stat_statements`.** |
| Workload | OLTP plus append-heavy accounting history; one plant (HDPE); largest table `kpi_results` at 26k rows |

**The data volume is small, which shapes most of this report.** Every query plan I measured runs in about 10 ms or less, and the cache hit ratio is 99.98%. Most findings are about **growth and design** rather than present slowness. Where a recommendation depends on future volume I label it as "projected" and do not present it as measured.

---

## 1. Executive summary: top 10 by impact

1. **F01: KPI and loss history grows with recompute churn, not plant time.** 97% of `kpi_results` rows (25,108 of 25,976) belong to *superseded* calculation runs. Only 16 of 326 runs are referenced by a revision. An open period is recomputed about 20 times an hour (170 runs for one period in 8 h, each with a distinct input hash). Triggers make these rows immutable, and nothing prunes them. Projected: each open unit-period writes about 1.6k KPI rows per hour, which is tens of millions of mostly dead rows a year per unit.
2. **F02: Planner statistics were wiped by an unclean shutdown.** 165 of 189 tables have never been analyzed (`reltuples = -1`), including `users`, `tenants`, `production_periods`, `accounting_revisions`, `loss_lines` and `rcas`. Plans are already mis-estimating: `production_periods` is estimated at 1 row when it returns 10.
3. **F03: The outbox relay holds a `FOR UPDATE` transaction while every consumer runs.** The in-process transport dispatches consumers inside the relay transaction (10 s timeout per row × 100 rows). Its anti-join uses a non-partial index over all retained history.
4. **F04: The period sweep and state engine have no index path for `inserted_at` or job history.** Measured today as a seq scan of 3.2k rows (2.7 ms). These queries run every 1 to 5 minutes per unit and will degrade linearly with samples.
5. **F05: Integration tests share the dev instance and cause checkpoint storms.** Checkpoints synced up to 22,918 files (82 s fsync, 244 s write phase). The app's 0.6 to 2 s `START TRANSACTION`/`COMMIT` warnings coincide with these runs.
6. **F06: The app logs in as superuser `postgres`.** Port 5432 is published on 0.0.0.0, and three `SECURITY DEFINER` functions are executable by `PUBLIC`.
7. **F07: N+1 patterns inside large lock-holding transactions.** Affected paths: bulk coding (up to 500 events, about 5 queries each), the reconciliation proposals list (about 8 to 10 queries per row, up to 500 rows), the RCA trigger sweep (about 8 queries per open event; starves events past the first 500) and the plan-approval consumer.
8. **F08: No query-level observability.** `pg_stat_statements` is not loaded, and `log_min_duration_statement`, `track_io_timing` and `log_lock_waits` are all off. Queries could not be ranked by total time (see section 5).
9. **F09: 71 prefix-redundant indexes plus 1 exact duplicate.** These are mostly the single-column `tenant_id` index added by `TenantScopedEntity`. `production_events` carries 25 indexes, 13 of which had no scans in the window.
10. **F10: The v1 audit-log endpoint has no limit cap and uses OFFSET.** `?limit=0` returns the whole table. The v1 production-events list uses OFFSET plus `count(DISTINCT)` over 7 joins.

---

## 2. Findings table

Severity reflects impact at expected production scale. "Measured now" is what the evidence shows today.

| ID | Area | Sev | Evidence (summary) | Proposed fix | Est. impact | Risk | Effort |
|---|---|---|---|---|---|---|---|
| F01 | Design / growth | **High** | 326 runs, 16 current; 868 of 25,976 KPI rows live; 20 runs/h per open period (§3.F01) | Product decision on retention of superseded-run detail (`kpi_results`, `loss_lines`, `loss_line_valuations`), then a retention job that is trigger-aware. Or debounce recompute of open periods. | Cuts the largest table about 30× and caps growth | Med: touches immutable history and the audit trail | M |
| F02 | Statistics | **High** | 165/189 tables `reltuples=-1`; plan estimate rows=1 vs actual 10 | `ANALYZE` (whole DB) now. Runbook: ANALYZE after any crash recovery. | Correct estimates; prevents bad join choices as data grows | Very low (no locks beyond SHARE UPDATE EXCLUSIVE) | XS |
| F03 | Locking / queue | **High** | `outbox-relay.service.ts:55-70` holds FOR UPDATE across `publishRows`; index `(tenant_id, aggregate_type, aggregate_id)` has no state filter, and `production_period_window` has 350 rows on one aggregate | App: claim and mark rows in a short transaction, then dispatch outside it. DB: partial index `(tenant_id, aggregate_type, aggregate_id, id) WHERE state='pending'`. | Removes long transactions and lock chains; anti-join cost stops growing with history | Low (index); Med (app change) | S + M |
| F04 | Index (projected) | Med | `NEW_SAMPLES_SQL` seq-scans `measurement_samples` (3,229 rows removed by filter); no index on `inserted_at`; `actuals_jobs` lacks `(period_id, kind, state, finished_at)` | `measurement_samples (signal_id, inserted_at)` built per partition; `actuals_jobs (period_id, finished_at) WHERE kind='recompute' AND state='completed'` | Keeps the 1-minute and 5-minute sweeps O(new samples) | Low (partitioned build needs per-partition CONCURRENTLY + ATTACH) | S |
| F05 | Infra / IO | Med | Checkpoints with 10k–23k sync files, max fsync 82 s; slow COMMIT at 22:20 UTC follows the 22:12 checkpoint (10,452 files, write 244 s) | Run integration tests on a separate throwaway container or a tmpfs-backed cluster (owner rule allows one `proact_test`, but not where it lives) | Removes dev-DB IO stalls | Low | S |
| F06 | Security | Med (dev) / High (prod) | `DB_USERNAME=postgres` (superuser, BYPASSRLS); `listen_addresses=*` and the `host all all all scram-sha-256` rule; port published 0.0.0.0:5432; `raw_observations_ensure_partition`, `measurement_samples_ensure_partition` and `rca_shared_lessons` are SECURITY DEFINER with default PUBLIC execute | Dedicated `proact_app` login (NOSUPERUSER, member of `proact_rls_user`, owns nothing); `REVOKE EXECUTE … FROM PUBLIC` + `GRANT` to `proact_rls_user`; bind the port to 127.0.0.1 in compose | Least privilege; RLS can't be bypassed by a bug that skips `SET ROLE` | Med (role switch must be tested with migrations-on-boot) | M |
| F07 | Query / N+1 | High | Code scan (§3.F07), spot-checked | App refactors: batch per-tenant lookups, set-based writes, page the RCA sweep by keyset, split the plan-approval consumer into jobs | Fewer round trips; shorter lock windows | Med | M–L |
| F08 | Observability | Med | `shared_preload_libraries=''`; `log_min_duration_statement=-1`; `track_io_timing=off`; `log_lock_waits=off` | Enable `pg_stat_statements` (needs a restart), `track_io_timing=on`, `log_lock_waits=on`, `log_min_duration_statement=500ms`, `log_temp_files=0`, `log_autovacuum_min_duration=1s` | Lets Phase 2 measure instead of project | Low (restart) | XS |
| F09 | Index hygiene | Low–Med | 71 prefix-redundant (66 with 0 scans) + `pi_af_elements` exact duplicate (`UQ_583d…` = `IDX_583d…`); 556/833 indexes unused in the window | Move affected entities to the base class without the `tenant_id` index (already exists, DB-09) + migration `DROP INDEX CONCURRENTLY`; drop the pi_af duplicate. Wait for ≥2 weeks of stats before dropping anything beyond pure prefixes. | Lower write amplification on hot tables (`production_events`, `ingestion_jobs`, `source_objects`, `event_revisions`) | Low | S–M |
| F10 | Query / pagination | High (if reachable) | `audit-log.controller.ts:91` `limit ?? 500` with no max; `audit-log.service.ts:79-80` `take` only if truthy, plus `skip(offset)`; `production-event.service.ts:59-62` skip/take + getManyAndCount over 7 joins | Cap limit (≤500) and switch to keyset; retire or keyset the v1 production-events list | Prevents full-table reads from a single request | Low | S |
| F11 | Index (FK) | Low–Med | 50 FKs without a leading index on the child column (§3.F11). Relevant: `rca_actions.rca_id`, `rca_causes.rca_id` (CASCADE), `event_relations.to_event_id`, `stop_reconciliations.*_event_id`, `approved_loss_lines.revision_id`, `period_change_proposals.period_id` | Index the ones on live v2 tables; leave v1 tables that are being dropped | Avoids seq scans on parent delete/update and on reverse lookups | Low | S |
| F12 | Design / legacy | Med | 9 tables with a tenant column but no RLS: `loss_categories`, `reconcile_forms`, `organizations`, `stream_*` (6, `tenantId varchar`, no FK). 10 `timestamp without time zone` columns, all on v1 tables. | Finish the v1 contract (pending `DropV1RcaTables` covers 10 RCA tables); decide drop vs RLS for `stream_*`, `loss_categories`, `reconcile_forms` | Closes tenant-isolation gaps | Med (contract migration, data check) | M |
| F13 | Index (projected) | Low | `breakdownGroups` index scan removes about 10 rows per loop on the `scope->>'level'/'dimension'` residual filter; `COMPLETE` does a correlated jsonb-equality probe | Later: `(run_id, metric, (scope->>'level'), (scope->>'dimension'))` or a generated `scope_level` column | Small now; matters only if F01 isn't fixed | Low | S |
| F14 | Config | Low | Defaults: `shared_buffers=128MB`, `work_mem=4MB`, `random_page_cost=4`, `effective_io_concurrency=1`, `idle_in_transaction_session_timeout=0`, `jit=on`; `buffers_backend`=3.0M vs `buffers_checkpoint`=0.2M | `shared_buffers=512MB`, `random_page_cost=1.1`, `effective_io_concurrency=200`, `idle_in_transaction_session_timeout=60s`, `jit=off` (OLTP) via a mounted `postgresql.conf` / `command:` args | Modest; mainly stops backends writing their own pages during test storms | Low (restart) | XS |
| F15 | Queue retention | Low | `outbox-retention.service.ts` filters `state='published' AND published_at<…` and `inbox processed_at<…`, with no supporting index (5k rows each today) | Partial indexes `outbox(published_at) WHERE state='published'`, `inbox(processed_at) WHERE processed_at IS NOT NULL` | Daily purge stays index-driven | Low | XS |
| F16 | Query / payload | Low–Med | Exports list selects full `case_content`/`filters` jsonb (`export-reads.service.ts:65-75`); `pi-inventory.ts:123-139` filters on `raw_observations.payload` with no LIMIT; period sweep reads `calculation_runs.input_fingerprint->>'asOf'` | Select only list columns; add a typed column for `asOf`; bound pi-inventory | Less TOAST detoasting on hot paths | Low | S |
| F17 | Hygiene | Low | `proact_test` (32 MB) still exists, against the "drop after each run" rule; `typeorm_metadata` has no PK (TypeORM-owned, ignore); 7 `double precision` columns (`rca_knowledge_base.downtime_reduced/effectiveness`, `historian_tags` thresholds, `stream_metrics`), none of them money | Drop `proact_test` (needs your OK); `numeric` for the RCA effectiveness fields if they feed reported figures | Tidiness | Very low | XS |

**Checked and clean:**
- Orphaned rows: 0 across all 167 `tenant_id` tables, and 0 on 15 unconstrained reference columns (`accounting_revisions.current_run_id`, `kpi_results.period_id`, `loss_lines.period_id`, `event_coding.*_code_id`, …).
- Invalid indexes and `NOT VALID` constraints: none.
- Deadlocks: 0. Lock waits: none at sampling time. Idle-in-transaction sessions: none.
- XID age: 1.6M, so no wraparound risk.
- Sequences: only `migrations_id_seq` (int) and `outbox_id_seq` (bigint), so no overflow risk.
- Bloat: dead tuples are below 30% on all tables with more than 50 rows. Queue tables (`ingestion_jobs`, `inbox`, `idempotency_keys`) already use `fillfactor=80`.
- Partition maintenance: `raw_observations` partitions exist through 2026-12; `measurement_samples` partitions are created on first insert by `sample-store.ts`.

---

## 3. Detailed evidence

### F01: Recompute churn
```sql
select count(*) runs,
       count(*) filter (where id in (select current_run_id from accounting_revisions)) referenced,
       (select count(*) from kpi_results k where k.run_id in (select current_run_id from accounting_revisions)) kpi_live,
       (select count(*) from kpi_results) kpi_total
from calculation_runs;
-- runs 326 | referenced 16 | kpi_live 868 | kpi_total 25,976
```
| period | runs | distinct input_hash | window | triggers |
|---|---|---|---|---|
| c23add2a… | 170 | 170 | 2026-10-19 18:30 → 10-20 02:35 | loss_event_changed, output_event_changed |
| 489d1b34… | 76 | 76 | 10-20 02:35 → 06:11 | loss_event_changed |
| 1a389d3a… | 47 | 47 | 10-19 16:22 → 18:31 | … |

Hourly runs for one period ran between 12 and 23 an hour. By status: `superseded` 310, `validated` 16. The `calculation_runs` average row is 4.9 kB (jsonb `input_fingerprint`, `policy_versions`, `stats`), and the table has 1.2 MB TOAST for 326 rows. `kpi_results` cannot be deleted because of `trg_kpi_results_immutable`, so any retention needs an explicit, audited bypass (for example a `SECURITY DEFINER` purge that the trigger recognises). That makes it a product and audit decision first, and I need your input on it.

**Since every recompute has a distinct input hash, the waste is not duplicate work.** It is history-per-recompute of a live open period. Options for `plans/DECISIONS.md`:
- (a) Keep only the current run plus runs that were ever submitted or approved.
- (b) Debounce open-period recompute, for example at most once per N minutes.
- (c) Keep run headers but prune their `kpi_results`/`loss_lines` after X days.

### F02: Statistics lost
Postgres log:
```
2026-10-19 00:02:47 UTC LOG: database system was not properly shut down; automatic recovery in progress
```
Crash recovery resets cumulative statistics. 165 of 189 tables now show `last_analyze IS NULL AND last_autoanalyze IS NULL`, and core tables show `reltuples=-1, relpages=0`. Autoanalyze on a small table only fires after `50 + 10%` modifications, so static master data (`users`, `units`, `assets`, `reason_codes`, `tenants`) may never be analyzed again. Mis-estimate seen in the breakdown report plan:
```
Index Scan using "IDX_production_periods_tenant_date" on production_periods p (cost=0.14..8.18 rows=1) (actual … rows=10 loops=1)
```
The likely cause of the unclean shutdown is Docker Desktop being stopped by the host "Disk Guard" when C: drops below 20 GB.

### F03: Outbox relay
`src/common/outbox/outbox-relay.service.ts:55-70` (verified): `dataSource.transaction(... SELECT … FOR UPDATE SKIP LOCKED … ; publishRows(manager, rows))`. Per the code scan, the bound transport (`in-process-outbox.transport.ts`) awaits `bus.dispatch`, so consumers such as `PeriodRecalcConsumer.onPlanApproved` run while the relay transaction holds row locks, with a 10 s timeout per row.

Indexes on `outbox`:
```
PK (id)
IDX_outbox_tenant_aggregate (tenant_id, aggregate_type, aggregate_id)        -- no state predicate
IDX_outbox_pending_next_attempt (next_attempt_at, id) WHERE state='pending'
```
Aggregate distribution (5,150 rows, all `published`, retained 90 days): `production_period_window` has 350 rows on 1 aggregate, `production_period` has 410 rows on 10, and `user_notification` has 20 rows on 1 (aggregate_id = tenant). The `NOT EXISTS` probe walks every retained row of the aggregate. A partial index restricted to `state='pending'` keeps it near 0 rows. **I could not measure this today because there are 0 pending rows.**

### F04: Sweeps over samples and job history
```
EXPLAIN (ANALYZE, BUFFERS) <NEW_SAMPLES_SQL for the busiest signal>
Seq Scan on measurement_samples_y2026m10 s (cost=0.00..150.35 rows=1) (actual time=2.760..2.760 rows=0)
  Filter: tenant_id=… AND signal_id=… AND inserted_at > … AND observed_at >= …
  Rows Removed by Filter: 3229      Buffers: shared hit=122
Execution Time: 5.030 ms
```
The only indexes are `PK (id, observed_at)` and `UQ (signal_id, observed_at, source_revision)`. The query asks for "samples stored after the cursor", and `inserted_at` is not indexed. The same applies to `LATE_STATE_SAMPLES` in `periods/period-sweep.job.ts:17-26` (every 5 min per period) and its `max(finished_at)` subquery on `actuals_jobs`, whose indexes are `(state, created_at)`, `(period_id)` and `(tenant_id)`.

Projection: a 1 Hz state signal adds 2.6M rows a month per signal. The current plan reads the whole month partition on every 1-minute tick. This is a projection; it is not measured.

### F05: Shared-instance checkpoint storms
The worst checkpoints in the last 24 h (from `log_checkpoints`):
```
2026-10-19 10:44:40 wrote 4972 buffers sync=82.302 s sync files=22918
2026-10-19 17:09:43 wrote 1639 buffers sync=41.284 s sync files=6383
2026-10-19 22:12:40 write=243.797 s sync=4.425 s sync files=10452
```
Normal checkpoints sync 30 to 160 files in under 0.1 s. The integration harness recreates the `public` schema of `proact_test` for each test file (about 190 tables, 800 indexes), which generates thousands of relation files per run. Backend log at that time:
```
10/19/2026 10:20:52 PM WARN [SlowQuery] 1522 ms: INSERT INTO "raw_observations" …
10/19/2026 10:20:52 PM WARN [SlowQuery] 654 ms: START TRANSACTION
10/19/2026 10:20:53 PM WARN [SlowQuery] 594 ms: COMMIT
```
`pg_stat_bgwriter`: `buffers_backend` 3,022,662 vs `buffers_checkpoint` 207,541, with 23 requested checkpoints (`CREATE DATABASE` forces them). The timing correlation is strong but not proven to be causal.

### F06: Privileges
```
rolname          rolsuper rolbypassrls rolcanlogin
postgres         t        t            t        <- used by API, worker, CLIs
proact_rls_user  f        f            f
pg_hba: host all all all scram-sha-256 ; listen_addresses='*' ; ssl=off
SECURITY DEFINER with NULL proacl (=PUBLIC EXECUTE): raw_observations_ensure_partition,
  measurement_samples_ensure_partition (both run CREATE TABLE as superuser), rca_shared_lessons
```
Public schema ACL is fine: `=U` for PUBLIC, with no CREATE. No table has `PUBLIC` grants.

### F07: N+1 / long transactions (code scan; outbox and audit-log lines verified by reading the code)
| Path | Pattern | Bound |
|---|---|---|
| `event-operations/bulk-code.service.ts:195-204, 224-231` | per event: re-lock, write, revision insert, plus `defaultsFor` (2 queries; same reason code each time) | 500 sync / 200 per chunk, under FOR UPDATE |
| `v2/reconciliation/proposal-after-values.ts:40-44` → `revision-state.ts:154-170` | `loadRevisionState` per proposal (about 8–10 queries) on a list endpoint | page ≤ 500 |
| `rca-case/triggers/rca-trigger-sweep.job.ts:41-48` | per open event: own transaction, about 8 queries, per-tenant rules re-read | 500 every 5 min; always the oldest 500, so later events starve |
| `periods/period-recalc.consumer.ts:125-151` | unbounded `periodsIn` + per-period slice writes + per-period `loadRevisionState` in one inbox transaction (inside the relay transaction, F03) | plan validity window |
| `reconciliation/change-proposals.service.ts:182-200`, `periods/slice-resolver.service.ts:52-138` | per-period updates/inserts | open periods in window |
| `intake/jobs/job-runner.service.ts:122-130` | one transaction per record (by design for idempotency) | 500 per page, 10 pages per 5 s |

No HTTP, PI or MQTT call was found inside a DB transaction. The scan rated the v2 list endpoints as consistently keyset-paginated (`v2/common/keyset-page.ts`, max 500).

### F09: Redundant indexes
71 non-unique indexes whose column list is a strict leading prefix of another index on the same table. 66 of them have `idx_scan = 0`; the ones with scans are `user_scopes.IDX_user_scopes_user` (76,917 scans, covered by `UQ_user_scopes_user_scope_role`), `attribute_mapping_versions…_tenant_template` (791), `production_profiles…_tenant_unit_product` (412), `month_closes` (318) and `plan_scenarios` (23). Dropping a used redundant index shifts its scans to the wider index, so I'd still verify those 5 with EXPLAIN in Phase 2. Most are hash-named `IDX_<hash>` on `tenant_id`, created by `@Index(['tenantId'])` in `TenantScopedEntity` (`src/common/entities/tenant-scoped.entity.ts:47`). The project already has the index-free base class for exactly this (DB-09). Dropping them only in SQL would break the entity-parity check in `migrations.int-spec.ts`, so each drop needs the entity change as well. Full list: Appendix A.

`production_events`: 25 indexes, 13 with zero scans in the window (`…_tenant_reason_start`, `…_unverified_stops`, `…_uncoded_stops`, `…_rca`, `…_plan`, `…_lot`, `…_origin_*`, `…_from/to_product`, `…_recovery_of`, `…_oee_code`, `…_impact_code`). **Do not drop these on 30 hours of stats.** Several back FKs or rarely run screens. Re-check after 2 or more weeks with `pg_stat_statements` on.

### F10: v1 pagination
`audit-log.controller.ts:91`: `limit: limit ? parseInt(limit, 10) : 500`. `audit-log.service.ts:79-80`: `if (filters.limit) qb.take(filters.limit); if (filters.offset) qb.skip(filters.offset);`. As a result `?limit=0` and `?limit=1000000` are both unbounded, and deep pages pay for OFFSET.

### F11: FKs without a leading child index (50)
On live v2 tables:
- `rca_actions.rca_id` (CASCADE)
- `rca_causes.rca_id` (CASCADE), `rca_causes.cause_code_id`
- `rca_trigger_evaluations.rca_id`
- `event_relations.to_event_id`
- `stop_reconciliations.kept_event_id`, `stop_reconciliations.evidence_event_id`
- `approved_loss_lines.revision_id`
- `period_change_proposals.period_id`, `reconciliation_line_sets.period_id`, `restatement_postings.period_id`
- `event_coding.{reason,impact,oee}_code_version_id`
- `event_impacts.rule_id`, `unit_impact_rules.asset_id`, `plant_flow_routes.to_unit_id`
- `signals.connection_id`, `signals.unit_id`, `signal_backfill_runs.signal_id`, `replay_runs.connection_id`, `rule_runs.rule_id`
- `production_events.reason_code_id`, `production_events.asset_id`

Several of these are covered by `(tenant_id, x, …)` composites, which serve tenant-scoped reads but not the FK check on a parent delete. The rest are v1 tables: `production_losses`, `reconcile_forms`, `loss_categories`, `oee_summaries`, `logic_tree_nodes`, `rca_evidence`, `rca_recommendations`, …

### Maintenance and health snapshot
```
cache hit 99.98% | temp_files 1 (208 kB) | deadlocks 0 | xact_rollback 24 / 1.41M
connections: 9 idle + 1 active (max_connections 100) | locks not granted: 0
checkpoints_timed 358 / req 23 | max XID age 1.63M
```
Two-minute steady-state scan rates: `ingestion_jobs` 47 seq/min and `export_jobs` 25 seq/min. Both are pollers on 8- and 38-row tables, where a seq scan is the correct plan, so no action is needed.

Errors in the Postgres log since 10-19:
- 193 × `pg_extension_name_index` duplicates, from concurrent `CREATE EXTENSION IF NOT EXISTS` in the test harness (harmless).
- 3 × `text = uuid` in the RCA recurrence watch. This is already fixed in HEAD (`rca-recurrence-watch.job.ts:42`).
- The immutability-trigger rejections are expected, raised by tests.

---

## 4. Proposed change plan (ordered by impact/risk)

**A. Safe now** (online, small, reversible; Phase 2 migrations unless noted):
1. F02: `ANALYZE` the database. This is maintenance, not schema. I propose running it directly, or as `scripts/` maintenance, rather than as a migration.
2. F03 (DB part): `CREATE INDEX CONCURRENTLY IDX_outbox_pending_aggregate ON outbox (tenant_id, aggregate_type, aggregate_id, id) WHERE state='pending'`.
3. F04: `actuals_jobs (period_id, finished_at) WHERE kind='recompute' AND state='completed'` (CONCURRENTLY). Then `measurement_samples (signal_id, inserted_at)`: create on the parent `ON ONLY`, build each partition CONCURRENTLY, then `ATTACH PARTITION` each one.
4. F15: retention partial indexes on `outbox` / `inbox`.
5. F11: indexes for the v2 FKs listed above (CONCURRENTLY; tables are tiny).
6. F09: drop the exact duplicate `IDX_583df9e4…` on `pi_af_elements`. This needs the entity checked, since it may be a TypeORM `@Index` duplicating a `@Unique`.

Note: TypeORM wraps migrations in a transaction, and `CONCURRENTLY` cannot run inside one. Concurrent migrations need `transaction = false` on the migration class. I'll check that `run-migrations-on-boot.ts` and the CLI honour it before using it.

**B. Needs a maintenance window or restart:**
7. F08 + F14: config via the compose `command:` flags: `shared_preload_libraries=pg_stat_statements`, logging settings, `shared_buffers`, `random_page_cost`, `idle_in_transaction_session_timeout`, `jit=off`. Then `CREATE EXTENSION pg_stat_statements` in a migration. This needs one Postgres restart.
8. F05: move integration tests to their own throwaway container. This is compose plus `scripts/ci.*`; it needs your go-ahead because it touches the single-Postgres rule.
9. F06: create the `proact_app` login role, `REVOKE EXECUTE … FROM PUBLIC` on the 3 definer functions, and bind 5432 to 127.0.0.1. Rolling it out means editing `.env`, which CLAUDE.md doesn't allow me to do, so you would apply that step.

**C. Needs app code changes:**
10. F01: retention or debounce for superseded runs. Needs a product decision first.
11. F03 (app part): dispatch outbox consumers outside the relay's lock transaction.
12. F07: batch the N+1 paths, page the RCA sweep by keyset, and split the plan-approval consumer.
13. F10: cap and keyset the v1 audit-log endpoint; retire or keyset the v1 production-events list.
14. F09 (bulk): move entities to the index-free base class plus `DROP INDEX CONCURRENTLY` for the 66 unused prefix indexes.
15. F12: finish the v1 contract (`DropV1RcaTables` is pending) and decide on `stream_*`, `loss_categories`, `reconcile_forms` and `organizations`.
16. F16: list projections and a typed `asOf` column.

---

## 5. Not verified, and why

- **Top queries by total/mean time.** `pg_stat_statements` is not installed, and enabling it needs a restart, which Phase 1 rules out. A 60-second `pg_stat_activity` sampling loop caught no active queries because every query finished in under 100 ms. Instead I used per-table scan rates, the app's slow-query log and EXPLAIN on the query shapes the code scan found.
- **Production volume and growth rate.** There is one plant with about 2 days of live data. Growth figures (F01, F04) are extrapolated from measured hourly rates.
- **Unused-index certainty.** Counters only cover about 30 hours since the crash reset, with no replicas. Monthly or rare screens may not have run in that window.
- **Bloat.** No `pgstattuple` extension. Estimates come from `n_dead_tup` only; all tables are under 8 MB, so bloat is immaterial today.
- **Backups and retention.** `archive_mode=off`, no WAL archiving, and no scheduled backup is visible. The only backup path is the manual `pg_dump` described in `docs/DOCKER.md` and `docs/CUTOVER_RUNBOOK.md`, and I can't see whether anyone runs it. **For the only permanent database, no automated backup exists that I could find.**
- **Host disk and IO characteristics.** Docker Desktop with a WSL2 virtual disk; I can't measure fsync latency directly from inside the container.
- **Code-scan items.** The outbox relay transaction and the audit-log limit were verified by reading the code. Other F07/F16 line references come from the automated scan and will be re-read before any change.

---

## Appendix A: Prefix-redundant indexes (table · redundant index · scans · covered by)

```
accounting_policies          IDX_fa20797ebbcfcbceb893c111c2  0      UQ_accounting_policies_kind_scope_version
actuals_adjustments          IDX_ea8fb7b5b790b42ec6c161651c  0      IDX_actuals_adjustments_tenant_period
approval_actions             IDX_7e1c798ad723662cfd98453fb7  0      IDX_approval_actions_tenant_period_created
approval_snapshots           IDX_b2468a20339717a30e1a29998f  0      IDX_approval_snapshots_tenant_period
approved_loss_line_valuations IDX_approved_loss_line_valuations_line 0 UQ_approved_loss_line_valuations_cell
attribute_mapping_versions   IDX_1510a82722301bb123b7211fbf  0      IDX_attribute_mapping_versions_tenant_template
attribute_mapping_versions   IDX_attribute_mapping_versions_tenant_template 791 UQ_attribute_mapping_versions_tenant_template_version
buffer_levels                IDX_ab7af7a9db037b87a30ad8cbc7  0      UQ_buffer_levels_reading
calendar_versions            IDX_42c70bceb21f44824c5545b48e  0      IDX_calendar_versions_tenant_site_unit
code_mapping_rules           IDX_12522f4e4a573535f49f91706b  0      UQ_code_mapping_rules_tenant_kind_source_version
code_versions                IDX_ccd01e20166022423d510a615a  0      IDX_code_versions_tenant_code
demand_statuses              IDX_3bf8a35c31c8c280c1a65451d8  0      IDX_demand_statuses_tenant_product_from
event_coding                 IDX_01e38f5ea9f551f60095f137dd  0      IDX_event_coding_tenant_event
event_relations              IDX_7fc5d781e06c4f407969f7d146  0      IDX_event_relations_tenant_from
event_review_items           IDX_768c28ade4f54ed5bfb3be28bb  0      IDX_event_review_items_tenant_state
event_revisions              IDX_61f562215e491df0d6be3089c8  0      IDX_event_revisions_tenant_event
export_jobs                  IDX_12376c181edbdcc0bfa1f432e2  0      IDX_export_jobs_tenant_created
external_production_reports  IDX_3bb69dab6cb26d5d09cdb139fd  0      IDX_external_production_reports_site_date
failure_code_groups          IDX_4a07909a5653e70d2e5e883550  0      IDX_failure_code_groups_tenant_parent
failure_dictionary_entries   IDX_cd1145cff62fe67d6f7302d884  0      IDX_failure_dictionary_entries_tenant_kind
feature_flags                IDX_b0564fcd9cfb5b4b9bd00429de  0      UQ_feature_flags_tenant_key
fx_rates                     IDX_1b7a67348d189f9f49f6f8f99f  0      IDX_fx_rates_tenant_type_pair_from
ingestion_exceptions         IDX_1d7e8e30b31a645b5ce4b323f0  0      IDX_ingestion_exceptions_tenant_state_last_seen
ingestion_jobs               IDX_d7911d18fe4de2373c4d79ced0  0      IDX_ingestion_jobs_tenant_connection
integration_connections      IDX_69a0ace0ec077a4dd7f55ccda3  0      IDX_integration_connections_tenant_source
loss_category_defs           IDX_830758bdb0fa45d45b34d17938  0      UQ_loss_category_defs_tenant_code
month_closes                 IDX_d58a5489812bd0bb3a3309af3b  318    UQ_month_closes_tenant_first_date
period_change_proposals      IDX_80e4e5c2b0f6f69646dca73bde  0      IDX_period_change_proposals_tenant_period_created
period_data_holds            IDX_7d579a1460bd013cca496c3b8b  0      IDX_period_data_holds_tenant_period
plan_scenarios               IDX_905e4f0b87f62e0dcc791e042c  23     UQ_plan_scenarios_tenant_name
plan_versions                IDX_b612b99ef80a15bb16c6695502  0      IDX_plan_versions_tenant_unit
plant_flow_routes            IDX_1d6559ddce3efa137676bc9c63  0      IDX_plant_flow_routes_tenant_to
production_day_certifications IDX_1e09340b68d8478a6133ebb4d9 0      IDX_production_day_certifications_tenant_date
production_periods           IDX_05f711ad4a10b54074f8ec67ab  0      UQ_production_periods_unit_start
production_profiles          IDX_ae728f988ed7af9c4bfe77b61a  0      IDX_production_profiles_tenant_unit_product
production_profiles          IDX_production_profiles_tenant_unit_product 412 UQ_production_profiles_key_version
rate_imports                 IDX_83749665d60550ebcbc2171fc6  0      UQ_rate_imports_document_revision
rca_actions                  IDX_f8d326764fd59e8c9a44748081  0      IDX_rca_actions_tenant_rca
rca_actions                  IDX_rca_actions_tenant_rca      0      IDX_rca_actions_tenant_rca_recommendation
rca_case_links               IDX_43fb31c1659c08cb74d9ce169a  0      IDX_rca_case_links_tenant_rca
rca_knowledge_base           IDX_52477a3c4a6cb7e34a8a27b8cb  0      IDX_rca_knowledge_base_tenant_asset
rca_trigger_evaluations      IDX_0b8772a88f0e68be361d6114dc  0      IDX_rca_trigger_evaluations_rca
rcas                         IDX_rcas_tenant                 0      IDX_rcas_tenant_created
reconciliation_line_sets     IDX_4def568e3a54288dd8f16bb896  0      IDX_reconciliation_line_sets_tenant_period
reconciliation_lines         IDX_2fbf7af88f913ca105c2c44708  0      IDX_reconciliation_lines_tenant_period
replay_runs                  IDX_2ce0e9b621d1ae4c01c4fb937e  0      IDX_replay_runs_tenant_connection
restatement_postings         IDX_9fbf19e5e72ff36f825959e133  0      IDX_restatement_postings_tenant_period
rule_runs                    IDX_c1110e5c2256f1e42a8927483b  0      IDX_rule_runs_tenant_rule_ran
rule_versions                IDX_1badad0d8d18d45cb93eeee6ae  0      IDX_rule_versions_tenant_rule
rules                        IDX_f1e5726c50ef2a632e178103c8  0      UQ_rules_tenant_name
signal_backfill_runs         IDX_7dd5b7d5b3d980501f6e7f106e  0      IDX_signal_backfill_runs_tenant_signal_created
signals                      IDX_7b1b2bc0fa110afda818239468  0      IDX_signals_tenant_connection_source
sites                        IDX_bee73a348dcf70a5e113e865bb  0      UQ_sites_tenant_name
source_mappings              IDX_ae9a6d92f453c8773b2227e0ee  0      IDX_source_mappings_tenant_kind
source_objects               IDX_e75c7fdfd17fc23147ee6c18e4  0      IDX_source_objects_tenant_connection_observed
source_status_mappings       IDX_887fc92f512228d4860e341404  0      UQ_source_status_mappings_version
standby_records              IDX_e32a020c89dbed51d53d26e5fc  0      IDX_standby_records_tenant_asset_start
state_engine_cursors         IDX_41de923dd1f5226edfeac125d7  0      UQ_state_engine_cursors_unit
stop_incident_breaks         IDX_6bf485a95f0c0c8fb72d228a7c  0      UQ_stop_incident_breaks_occurrence
stop_incidents               IDX_e9a363021da71ef233e60b1210  0      IDX_stop_incidents_tenant_unit_start
stop_reconciliations         IDX_8458d7310a56c10ed38fd8e3ef  0      IDX_stop_reconciliations_tenant_evidence
stream_runs                  IDX_7b4828e54cf099626221a42c90  0      IDX_stream_runs_tenant_unit_start
transition_standards         IDX_7aca87f7b0403c779920474181  0      IDX_transition_standards_tenant_unit
unit_impact_rules            IDX_c031a85158e72fbab7deccbd1c  0      IDX_unit_impact_rules_tenant_unit_asset
unit_product_rates           IDX_c756eb42e3acfec0ff7673fc47  0      IDX_unit_product_rates_tenant_kind_external
unit_state_mappings          IDX_8c8c3702fc08ec58a536e91021  0      IDX_unit_state_mappings_tenant_unit_from
unit_streams                 IDX_ab248cb66cf01a2254f835aaf3  0      IDX_unit_streams_tenant_unit
user_notifications           IDX_14c3aac4fa45210bfd61640e67  0      UQ_user_notifications_user_key
user_scopes                  IDX_29fd3a7a95156f68d757b2aa36  0      IDX_user_scopes_tenant_user
user_scopes                  IDX_user_scopes_user            76917  UQ_user_scopes_user_scope_role
work_order_operations        IDX_68ad038635e2343241e4c85215  0      IDX_work_order_operations_tenant_asset_start
```
Exact duplicate: `pi_af_elements`: `UQ_583df9e4a4a26098718f37c8e6f` and `IDX_583df9e4a4a26098718f37c8e6` (same key).
