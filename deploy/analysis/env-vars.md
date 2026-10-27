# Environment variables — inventory (TF-PREP-001 §3.1)

Generated 2026-10-26 from a read-only sweep of `server/pro-act-backend` (BE) and the frontend at the repo root.

How configuration is read:
- No ConfigService, `registerAs`, Joi or zod schema. Every backend read is `process.env.X`, an injectable
  `env = process.env` parameter, or `envInt(name, fallback)` (`BE/src/common/helpers/time-bounds.ts:39`).
- `.env` is loaded by `dotenv.config()` from the working directory (`BE/src/app.module.ts:49`, `BE/src/database/data-source.ts:8`).
  dotenv never overrides a variable already set in the environment.
- Side: **api** = `PROCESS_ROLE=api|all`; **worker** = `worker|all`; **both** = either; **scripts** = `BE/scripts/*` only.

## Database

| Name | Side | Default | Read at | Purpose |
|---|---|---|---|---|
| DB_HOST | both | `localhost` | BE/src/database/data-source.ts:22 | Postgres host |
| DB_PORT | both | `5432` | data-source.ts:23 | Postgres port |
| DB_USERNAME | both | `postgres` | data-source.ts:24 | Login role (TF-PREP-001 calls it `DB_USER`) |
| DB_PASSWORD | both | `''` | data-source.ts:25 | Password |
| DB_NAME | both | `proact` | data-source.ts:26 | Database |
| DB_LOGGING | both | off | data-source.ts:30 | TypeORM query logging |
| DB_SLOW_QUERY_MS | both | `500` | data-source.ts:52 | Slow-query warning |
| DB_POOL_MAX | both | `10` | data-source.ts:55 | pg pool `max` (no idle timeout is set) |
| DB_STATEMENT_TIMEOUT_MS | both | `30000` | data-source.ts:56 | Runtime `statement_timeout` |
| DB_CONNECT_TIMEOUT_MS | both | `10000` | data-source.ts:57 | Connect timeout |
| DB_MIGRATIONS_RUN | api | on (`'false'` disables) | BE/src/database/run-migrations-on-boot.ts:12 | Runs pending TypeORM migrations before the API boots |
| DB_RLS_TENANT_BINDING | api | on | BE/src/database/rls/tenant-session-binding.ts:86 | `SET ROLE proact_rls_user` + tenant list per checkout |
| EXTERNAL_REPORT_CERTIFIED_STATUSES | migration | `COMPLETED,RELEASED` | migrations/1794010200000-RestatementPostingSourceStatus.ts:66 | Data migration input |

There is no `DB_SCHEMA` and no `DB_SSL`. TypeORM sets no `schema`, and nothing sets `search_path`.

## Auth / crypto

| Name | Side | Default | Read at | Purpose |
|---|---|---|---|---|
| JWT_SECRET | both | `'changeme'` | BE/src/auth/jwt.constants.ts:9 | Access-token key; also the fallback credential key |
| JWT_REFRESH_SECRET | api | HMAC-SHA256 of JWT_SECRET | BE/src/auth/tokens/token-config.ts:49 | Refresh-token key |
| JWT_ACCESS_TTL | api | `15m` | token-config.ts:52 | Access-token lifetime |
| JWT_REFRESH_EXPIRATION | api | `7d` | token-config.ts:56 | Refresh-token lifetime |
| JWT_REFRESH_REUSE_GRACE | api | `30s` | token-config.ts:60 | Reuse grace window (parallel tabs) |
| AUTH_ALLOW_PUBLIC_REGISTRATION | api | off | BE/src/auth/auth.service.ts:163 | Opens `/auth/register` |
| BCRYPT_ROUNDS | scripts | `10` | BE/scripts/bootstrap-admin.ts:94 | Cost for seeded users only |
| CREDENTIAL_ENCRYPTION_KEY | both | JWT_SECRET, then a hard-coded fallback | BE/src/common/services/credential-encryption.service.ts:37 | `enc:v1:` AES-256-GCM key for stored connector passwords |
| CREDENTIAL_ENCRYPTION_KEYS | both | empty | credential-encryption.service.ts:41 | Key ring `id:secret,…` (each ≥ 16 chars) |
| CREDENTIAL_ENCRYPTION_KEY_ID | both | null | credential-encryption.service.ts:54 | Current key id for `enc:v2:` |

## HTTP / proxy / process

| Name | Side | Default | Read at | Purpose |
|---|---|---|---|---|
| PORT | api | `3000` in code; Dockerfile sets `4004` | BE/src/main.ts:111 | API port |
| WORKER_PORT | worker | `4005` | BE/src/health/worker-health.server.ts:96 | Worker probe port |
| PROCESS_ROLE | both | `all` | BE/src/common/scheduling/process-role.ts:21 | `api`, `worker` or `all` |
| NODE_ENV | api | dev unless `production` | BE/src/main.ts:28 | Enables CORS allowlist; reported by health |
| CORS_ORIGIN | api | all origins outside production | main.ts:39 | Allowed origins |
| TRUST_PROXY | api | unset | BE/src/common/http/configure-http-app.ts:35 | Express `trust proxy` |
| HTTP_KEEP_ALIVE_TIMEOUT_MS | api | `65000` | configure-http-app.ts:53 | Keep-alive |
| THROTTLE_TTL_MS / THROTTLE_LIMIT | api | `60000` / `300` | BE/src/common/throttling/throttler.config.ts:14 | Rate limit |
| CONNECTOR_EGRESS_ALLOWLIST | both | empty = unrestricted | BE/src/common/security/egress-allowlist.ts:26 | Outbound connector hosts |
| SHUTDOWN_DRAIN_TIMEOUT_MS | both | `30000` | BE/src/common/scheduling/shutdown-coordinator.service.ts:80 | Graceful drain |
| METRICS_PORT | api | unset = off | BE/src/common/metrics/metrics.ts:76 | Prometheus port |

## Integration and jobs (worker unless noted)

| Name | Default | Read at |
|---|---|---|
| MQTT_RECONCILE_INTERVAL_MS / MQTT_HEARTBEAT_INTERVAL_MS | `10000` / `20000` | BE/src/intake/adapters/mqtt/host/mqtt-subscriber-host.job.ts:17,29 |
| PI_HTTP_TIMEOUT_MS / PI_HTTP_MAX_ATTEMPTS / PI_HTTP_RETRY_BASE_MS / PI_HTTP_MAX_RESPONSE_BYTES (both) | `30000` / `3` / `500` / `67108864` | BE/src/integration/pi/pi-client-factory.ts:52-55 |
| PI_BATCH_SIZE / PI_INVENTORY_PAGE_SIZE / PI_ELEMENT_CACHE_TTL_MS | `250` / `1000` / `600000` | pi-batch.ts:48, pi-inventory.ts:102, pi-frame-reader.ts:29 |
| INTAKE_LEASE_SECONDS / INTAKE_READ_TIMEOUT_MS / INTAKE_MAX_RETRIES | `60` / `120000` / `10` | BE/src/intake/jobs/job-runner.service.ts:81,110,182 |
| REPLAY_LEASE_SECONDS / REPLAY_PAGE_SIZE | `120` / `200` | BE/src/intake/replay/* |
| OUTBOX_BATCH_SIZE / OUTBOX_PUBLISH_TIMEOUT_MS / OUTBOX_MAX_ATTEMPTS | `100` / `10000` / `12` | BE/src/common/outbox/outbox-relay.service.ts |
| OUTBOX_RETENTION_DAYS / OUTBOX_RETENTION_BATCH | `90` / `1000` | outbox-retention.job.ts:28-29 |
| BULK_JOB_LEASE_SECONDS | `120` | BE/src/event-operations/bulk-job.service.ts:185 |
| STATE_ENGINE_LOOKBACK_HOURS / STATE_ENGINE_LATE_SAMPLE_HOURS | `24` / `168` | BE/src/stop-events/derived-stop-engine.service.ts:117-118 |
| RCA_SWEEP_BATCH | `500` | BE/src/rca-case/triggers/rca-trigger-sweep.job.ts:38 |
| PLAN_GENERATION_LEASE_SECONDS, PLAN_MAX_DAYS (both), CONCURRENT_PRODUCTS (both, flag) | `120`, `400`, off | BE/src/plans/* |
| ACTUALS_JOB_LEASE_SECONDS, PERIOD_MATERIALIZE_LOOKBACK_HOURS, ACTUALS_SETTLE_SECONDS, ACTUALS_RECHECK_DAYS | `120`, `48`, `900`, `7` | BE/src/periods/* |
| NOTIFY_DUE_LEAD_DAYS, NOTIFY_OVERDUE_ESCALATE_DAYS, NOTIFY_UNCODED_AGE_HOURS, NOTIFY_UNCODED_ESCALATE_HOURS, NOTIFY_LONG_STOP_HOURS, NOTIFY_LONG_STOP_ESCALATE_HOURS, NOTIFY_LOOKBACK_DAYS | `2`, `7`, `4`, `24`, `2`, `8`, `62` | BE/src/notifications/work-reminder-config.ts |
| REALTIME_FEED_ENABLED (api, flag), REALTIME_POLL_MS, REALTIME_BATCH_SIZE, REALTIME_QUERY_TIMEOUT_MS, REALTIME_GAP_GRACE_MS, REALTIME_REPLAY_SIZE (api) | on, `1000`, `500`, `5000`, `10000`, `500` | BE/src/realtime/* |

## Storage, exports, retention

| Name | Default | Read at | Note |
|---|---|---|---|
| EXPORT_STORAGE_DIR (both) | `./storage/exports` (compose `/app/storage/exports`) | BE/src/exports/export-storage.ts:51 | Needs a volume |
| EXPORT_TTL_HOURS, EXPORT_JOB_LEASE_SECONDS, EXPORT_JOB_MAX_ATTEMPTS, EXPORT_PAGE_SIZE | `168`, `300`, `3`, `200` | BE/src/exports/* | |
| EXPORT_MAX_SOURCES, EXPORT_PDF_MAX_SOURCES, EXPORT_MAX_WINDOW_DAYS (api) | `50000`, `500`, `400` | export-requests.service.ts | |
| EXPORT_PDF_FONT / EXPORT_PDF_FONT_BOLD | Helvetica | BE/src/exports/pdf/pdf-fonts.ts:17,23 | Persian glyphs need a TTF |
| REPORT_LOGO_PATH | `<cwd>/assets/marun.png` | report-pdf-kit.ts:117 | |
| AUDIT_REQUEST_LOG_RETENTION_DAYS, AUDIT_TRAIL_RETENTION_DAYS, RAW_RETENTION_DAYS, SAMPLE_RETENTION_DAYS | unset = keep forever (compose 30/30/365/90) | BE/src/common/retention/retention-policy.ts:45-48 | RAW/SAMPLE drop partitions (DDL) |
| RETENTION_BATCH | `1000` | retention-policy.ts:49 | |

Uploads have no variable: `join(process.cwd(), 'uploads')`, limit 25 MiB (`BE/src/common/http/upload-options.ts:16`).

## Set by compose but never read by code

`KAFKA_BROKERS` and `MQTT_URL`. The outbox uses an in-process transport, and MQTT broker URLs come from per-tenant connection rows.

## Scripts only

`PROACT_API_URL`, `DEMO_SEED_EMAIL/PASSWORD`, `DEMO_APPROVER_EMAIL/PASSWORD`, `MARUN_TRAIN_PASSWORD`, `MARUN_TRAIN_MQTT_URL/USER/PASSWORD` (default user and password are the dev broker's), `MQTT_SIM_PASSWORD`, `DEMO_MQTT_BROKER_URL`, `API_AUDIT_ORIGIN`, `API_AUDIT_TENANT_ID`. Legacy SQL Server-era scripts (`check-database-status.ts`, `delete-all-data.ts`, `ensure-roles-tasks.ts`) default to port 1433, user `sa` and database `ProActDB`.

## Frontend build (Vite) and nginx runtime

| Name | Kind | Default | Read at |
|---|---|---|---|
| VITE_API_BASE_URL | build | `http://localhost:4004/api` in code; Docker build arg `/api` | src/services/api/apiBaseUrl.ts:17 (runtime override `window.__PROACT_API_BASE_URL__`) |
| VITE_PI_SERVER | dev server only | `https://87.107.103.198:7443` | vite.config.ts:41 |
| import.meta.env.DEV | build | Vite mode | dev-only UI hints |
| PROACT_API_INTEGRATION | test | off | vitest.config.ts:7 |
| BACKEND_URL | nginx runtime | `http://backend:4004` | docker/nginx/default.conf.template |
| PI_SERVER | nginx runtime | `https://87.107.103.198:7443` | same |
| CLIENT_MAX_BODY_SIZE | nginx runtime | `25m` | same |

No `TZ`/`PGTZ` is read. The plant time zone is data: `sites.timezone`, then `tenants.timezone`, then `UTC` (`BE/src/v2/activity-summary/plant-timezone.ts:36`).
