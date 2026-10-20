# Database audit: change log, monitoring and runbook

Companion to [AUDIT_REPORT.md](AUDIT_REPORT.md). Applied to `proact` on `proact-postgres` on 2026-10-20. Decisions are recorded in `plans/DECISIONS.md`, under "2026-10-20 — Database audit".

## Changes and measurements

Timings are warm `EXPLAIN (ANALYZE, BUFFERS)` runs on the dev database. The benchmark script is `bench.sql`; the queries are listed in the audit report's section 3.

| ID | Change | How | Before | After |
|---|---|---|---|---|
| F02 | Planner statistics rebuilt | `ANALYZE` (2.4 s, maintenance, not a migration) | 165/189 tables never analyzed. KPI breakdown report 10.3 ms, `production_periods` estimate 1 row vs 10 actual | 0 tables unanalyzed. Report 2.8 ms, estimate 10 = actual |
| F04 | `IDX_measurement_samples_signal_inserted (signal_id, inserted_at)` on the partitioned parent | Migration `1794240600000-MeasurementSamplesInsertedIndex` + `@Index` on `MeasurementSample` | State-engine "new samples" query: seq scan of the month partition, 59 buffers, 0.36 ms | Index scan, 2 buffers, 0.08–0.14 ms. Index 144 kB |
| F09 | Duplicate `IDX_583df9e4…` on `pi_af_elements.web_id` | Migration `1794240610000-DropPiAfElementDuplicateIndex` (skips when the table is absent) | Two identical indexes | Superseded: `DropV1LegacyTables1794240600000` (another session, owner-approved) dropped the whole table |
| F05 | Integration tests moved off the dev server | `docker-compose.testdb.yml`, `npm run test:int` / `testdb:down`, `test/integration/setup-env.ts`, `scripts/ci.*`, `ci.yml` → `test:int:ci` | Checkpoints with 10k–23k files to sync, up to 82 s fsync, app commits 0.6–2 s | `migrations.int-spec` 6/6 in 32 s on the throwaway server; the dev server is not touched |
| F08 | `pg_stat_statements` | `shared_preload_libraries` (restart) + migration `1794240700000-PgStatStatements` | No statement statistics | Collecting (133 statements in the first minute) |
| F08/F14 | Logging and planner settings | `ALTER SYSTEM` on `proact-postgres`; `command:` in `docker-compose.yml` | Defaults | See the settings table below |
| F17 | `proact_test` dropped from `proact-postgres` | `DROP DATABASE` (done by the other session after its last run) | 32 MB leftover | Only `proact` remains |

Every migration went through apply → revert → apply on `proact`, and `migrations.int-spec` passed (entity parity, full revert to empty, re-run). Typecheck and lint are clean on the changed files, and the `signals` unit tests pass.

**Server settings** (`postgresql.auto.conf`):

| Setting | Was | Now |
|---|---|---|
| `shared_preload_libraries` | '' | `pg_stat_statements` |
| `shared_buffers` | 128 MB | 512 MB |
| `random_page_cost` | 4 | 1.1 |
| `effective_io_concurrency` | 1 | 200 |
| `jit` | on | off |
| `track_io_timing` | off | on |
| `log_min_duration_statement` | -1 | 500 ms |
| `log_lock_waits` | off | on |
| `log_temp_files` | -1 | 0 |
| `log_autovacuum_min_duration` | 10 min | 1 s |
| `idle_in_transaction_session_timeout` | 0 | 15 min |

**Measured and not applied** (the evidence did not support a change; see the audit report §4):
- the F03 pending-aggregate index (the relay probe already uses `IDX_outbox_pending_next_attempt`, 0.05 ms);
- the `actuals_jobs` index (`(period_id)` already exists, 0.2 ms);
- the F15 retention indexes (3.5 ms / 1.2 ms daily);
- the F11 FK indexes (the composites lead with `tenant_id`; the fix is adding the tenant predicate in code).

## Monitoring checklist (after each deploy)

```sql
-- Top statements by total time (reset after a deploy: SELECT pg_stat_statements_reset();)
SELECT round(total_exec_time) AS total_ms, calls, round(mean_exec_time::numeric, 2) AS mean_ms, rows,
       shared_blks_read, left(query, 120)
  FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
-- Alert: any mean_ms > 100 on a statement with calls > 1000/day; any new entry in the top 5.

-- Tables read mostly by seq scan that are no longer small
SELECT relname, seq_scan, seq_tup_read, idx_scan, n_live_tup FROM pg_stat_user_tables
 WHERE n_live_tup > 10000 AND seq_scan > coalesce(idx_scan, 0) ORDER BY seq_tup_read DESC LIMIT 10;

-- Statistics freshness (expect 0 rows; after any crash recovery run ANALYZE)
SELECT relname FROM pg_stat_user_tables WHERE last_analyze IS NULL AND last_autoanalyze IS NULL AND n_live_tup > 0;

-- Growth of the history tables (F01): superseded share of kpi_results
SELECT count(*) FILTER (WHERE r.status = 'superseded') * 100.0 / count(*) AS superseded_pct, count(*)
  FROM kpi_results k JOIN calculation_runs r ON r.id = k.run_id;

-- New index in use
SELECT indexrelname, idx_scan FROM pg_stat_user_indexes WHERE indexrelname LIKE '%signal_id_inserted_at%';

-- Long / idle transactions and lock waits (alert above 60 s)
SELECT pid, state, now() - xact_start AS age, left(query, 80) FROM pg_stat_activity
 WHERE xact_start IS NOT NULL AND now() - xact_start > interval '60 seconds';
```

Also watch the server log for `duration:` lines (≥ 500 ms), `process … still waiting for` (lock waits), `temporary file:` and the `checkpoint complete … sync=` time (alert when it is above 5 s).

## Deployment runbook

Order:
1. **Server settings.** Add the `command:` flags (or `ALTER SYSTEM`), then restart Postgres once in a quiet window. Postgres refuses to start if `pg_stat_statements` is missing from the image; it ships with the official images.
2. **Migrations** (applied on boot or with `npm run migration:run`):
   - `1794240600000-MeasurementSamplesInsertedIndex`
   - `1794240610000-DropPiAfElementDuplicateIndex`
   - `1794240700000-PgStatStatements`
3. **`ANALYZE`** after the migrations, and after any unclean shutdown.

Large-database note: the samples index migration takes a SHARE lock per partition while it builds. On a large table, pre-build it online so the migration becomes a no-op (`IF NOT EXISTS`):

```sql
CREATE INDEX "IDX_measurement_samples_signal_inserted" ON ONLY measurement_samples (signal_id, inserted_at);
-- for each partition p:
CREATE INDEX CONCURRENTLY <p>_signal_id_inserted_at_idx ON <p> (signal_id, inserted_at);
ALTER INDEX "IDX_measurement_samples_signal_inserted" ATTACH PARTITION <p>_signal_id_inserted_at_idx;
```

Rollback:
- **Migrations:** `npm run migration:revert`, once per migration, newest first. Each `down()` was tested.
- **Settings:** `ALTER SYSTEM RESET <name>;` (or remove the `command:` flags), then restart.
- **Test container:** `npm run testdb:down`. To return to the old behaviour, run `npm run test:int:ci` with `DB_*` set.

## Deferred (open findings)

| ID | What | Next step |
|---|---|---|
| F01 | Superseded-run detail retention + open-period recompute coalescing | Decided (DECISIONS.md, 2026-10-20). Implementation: a trigger migration with a cutoff GUC (as for `audit_log`), the retention job and the coalescing |
| F03 | Outbox relay dispatches consumers inside its lock transaction | App: claim and mark rows in a short transaction, dispatch outside it |
| F06 | App logs in as superuser; 5432 on 0.0.0.0; PUBLIC execute on 3 SECURITY DEFINER functions | `proact_app` login role (needs a `.env` change by the owner), `REVOKE … FROM PUBLIC`, bind to 127.0.0.1 |
| F07 | N+1 in bulk coding, proposals list, RCA trigger sweep (starvation past 500), plan-approval consumer | App refactors |
| F09 | 71 prefix-redundant `tenant_id` indexes (66 unused) | Move entities to the index-free base (DB-09) + `DROP INDEX`. Re-check after ≥ 2 weeks of `pg_stat_statements` / index stats |
| F10 | v1 audit-log endpoint: no limit cap + OFFSET; v1 production-events OFFSET + count over 7 joins | Cap and use keyset, or retire |
| F11 | `approved_loss_lines` lookups by `revision_id` without `tenant_id` | Add the tenant predicate in `approved-impact.ts`, `approved-trigger-inputs.ts`, `event-attributed-losses.sql.ts` |
| F12 | Tenant tables without RLS | Largely resolved by `DropV1LegacyTables` (`stream_*`, `loss_categories`, `reconcile_forms` dropped); re-check `organizations` |
| F13 | jsonb `scope` residual filters on `kpi_results` | Revisit after F01; generated `scope_level` column if still needed |
| F16 | Exports list loads full jsonb; `pi-inventory` unbounded payload filter; `input_fingerprint->>'asOf'` in the sweep | Column projections, typed `as_of` column, LIMIT |
| — | Backups | No WAL archiving or scheduled `pg_dump` for `proact`. Decide a backup schedule and retention (DECISIONS D07 open item) |
