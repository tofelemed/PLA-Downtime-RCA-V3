# Running Pro-Act with Docker

Everything needed to run the platform in containers lives at the repo root:

| File | Purpose |
|------|---------|
| `Dockerfile` | Frontend image: Vite build served by non-root nginx (`nginx-unprivileged`, uid 101, port 8080), which also reverse-proxies the backend |
| `docker/nginx/default.conf.template` | nginx config (SPA fallback + proxy for `/api`, `/uploads`, `/socket.io`, `/piwebapi`) |
| `server/pro-act-backend/Dockerfile` | Backend image: NestJS compiled to `dist/`, production dependencies only; `PROCESS_ROLE=api\|worker\|all` selects the entrypoint |
| `docker/mosquitto/mosquitto.conf` | Dev MQTT broker config: anonymous MQTT + WebSockets listeners, a password-protected listener and a TLS listener (plan 1.8 step 4); `passwd` / `acl` hold the dev-only users, `certs/` the dev CA + server certificate from `gen-dev-certs.sh` |
| `docker-compose.yml` | `frontend` + `backend` (API) + `worker` + bundled `postgres`, `kafka`, `mqtt`; `kafka-ui` behind the `tools` profile |
| `docker-compose.external-db.yml` | Override that points backend and worker at the shared `instrumental-postgres` container instead |
| `docker-compose.shared-infra.yml` | Override that reuses the host's `instrumental-kafka-*` cluster and `mosquitto` broker instead of the bundled ones |
| `.env.example` | Compose settings; copy to `.env` (git-ignored) |
| `.github/workflows/ci.yml`, `scripts/ci.*` | CI pipeline and its local wrapper (`npm run ci`), see [CI](#ci) |

## Quick start

```bash
cp .env.example .env          # set POSTGRES_PASSWORD and JWT_SECRET at minimum
docker compose up -d --build
docker compose exec backend node dist/scripts/seed-demo-users.js   # login-page demo accounts
```

Then open http://localhost:8070 and log in with `test@example.com` / `Test123!@#` (or any `*@acme.com` / `demo123` account).

| Service | URL on the host | Notes |
|---------|-----------------|-------|
| frontend | http://localhost:8070 | nginx; API, uploads and Socket.IO are reachable on this same origin |
| backend | http://localhost:4004/api/health | API process (`PROCESS_ROLE=api`); Swagger UI at http://localhost:4004/api |
| worker | (no host port) | Schedulers/connectors (`PROCESS_ROLE=worker`); probes on `:4005/health/live` and `/health/ready` inside the container |
| postgres | `localhost:5433` | database `proact`; 5433 because the shared container already uses 5432 |
| kafka | `localhost:9092` | single-node KRaft broker (cp-kafka 7.5.0); other containers use `kafka:29092` |
| mqtt | `mqtt://localhost:1884`, WebSockets `ws://localhost:8884`; with password `mqtt://localhost:1885`; TLS `mqtts://localhost:8885` | eclipse-mosquitto 2.1.2; 1884/8884 anonymous, 1885/8885 need a dev user (see [Broker users and TLS](#broker-users-and-tls-dev-only)); other containers use `mqtt://mqtt:1883` (`mqtts://mqtt:8883`) |
| kafka-ui | http://localhost:8085 | optional: `docker compose --profile tools up -d kafka-ui` |

The host ports come from the `*_PORT` keys in `.env` (`FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT`, `KAFKA_PORT`,
`KAFKA_UI_PORT`, `MQTT_PORT`, `MQTT_WS_PORT`, `MQTT_AUTH_PORT`, `MQTT_TLS_PORT`). The frontend/backend defaults match the local dev servers, so stop
`npm run dev` / `npm run start:dev` first or pick other ports. The Kafka and MQTT defaults avoid the host's own
containers: `mosquitto` owns 1883/8883 (hence 1884/8884), `instrumental-kafka-ui` owns 8080 (hence 8085), and
`instrumental-kafka-1` owns 9092 only while that cluster is running (change `KAFKA_PORT` or use the shared-infra
override in that case).

On boot the API applies pending TypeORM migrations (`DB_MIGRATIONS_RUN=true`, migrations live in
`server/pro-act-backend/src/database/migrations`); `docker compose ps` shows the backend as `healthy` once
`/api/health` reports the database connected. The worker starts only after the API is healthy, never runs
migrations itself (`DB_MIGRATIONS_RUN=false`), and is `healthy` once `/health/ready` on its `WORKER_PORT` sees the
database. The backend and worker do not wait for Kafka/MQTT; connectors retry until the brokers answer.

## How the pieces fit together

```
browser ──► frontend (nginx :8080 → host :8070)
              ├─ /            static Vite build (SPA fallback to index.html)
              ├─ /api         ─┐
              ├─ /uploads      ├──► backend (NestJS API :4004 → host :4004) ──► postgres :5432
              ├─ /socket.io   ─┘                                            ├──► kafka :29092 (host :9092)
              └─ /piwebapi    ──► PI_SERVER (AVEVA PI Web API)              └──► mqtt :1883   (host :1884)
                                                                             ▲
            worker (same image, PROCESS_ROLE=worker; schedulers + connectors) ─┘  probes :4005 (container only)
```

The API and worker are the same image started with different `PROCESS_ROLE` values (`server/pro-act-backend/docker/entrypoint.sh`);
`all` (the default outside Compose, e.g. `npm run start:dev`) runs both halves in one process.

The frontend image is built with `VITE_API_BASE_URL=/api`, so the browser talks to the backend through nginx on
the page's own origin. That removes CORS from the picture and means the same image works whatever hostname or IP
the users type. `src/services/api/apiBaseUrl.ts` resolves the REST base URL and derives the Socket.IO URL from it.

nginx resolves `BACKEND_URL` at request time via Docker's DNS, so it starts even if the backend is still booting
and follows the backend container across restarts.

## Configuration

All settings are read by `docker compose` from `.env` (or the shell environment).

| Variable | Default | Used by | Meaning |
|----------|---------|---------|---------|
| `FRONTEND_PORT` | `8070` | compose | Host port for nginx (container port 8080) |
| `BACKEND_PORT` | `4004` | compose | Host port for the API (direct access, Swagger) |
| `POSTGRES_PORT` | `5433` | compose | Host port for the bundled Postgres |
| `KAFKA_PORT` | `9092` | compose, kafka | Host port of the bundled broker (also its advertised `localhost:` listener) |
| `KAFKA_UI_PORT` | `8085` | compose | Host port of `kafka-ui` (`tools` profile) |
| `MQTT_PORT` / `MQTT_WS_PORT` | `1884` / `8884` | compose | Host ports of the bundled broker (MQTT / MQTT over WebSockets), anonymous |
| `MQTT_AUTH_PORT` / `MQTT_TLS_PORT` | `1885` / `8885` | compose | Host ports of the password-protected listener and the TLS listener (container 1885 / 8883) |
| `POSTGRES_USER` | `postgres` | postgres, backend, worker | Database user |
| `POSTGRES_PASSWORD` | required | postgres, backend, worker | Database password |
| `POSTGRES_DB` | `proact` | postgres, backend, worker | Database name |
| `DB_HOST` / `DB_PORT` | `postgres` / `5432` | backend, worker | Database address as seen from inside the containers |
| `DB_MIGRATIONS_RUN` | `true` | backend | Apply pending TypeORM migrations on boot (the worker is always `false`) |
| `KAFKA_BROKERS` | `kafka:29092` | backend, worker | Kafka bootstrap servers as seen from inside the containers |
| `MQTT_URL` | `mqtt://mqtt:1883` | backend, worker | MQTT broker URL as seen from inside the containers |
| `PROCESS_ROLE` | fixed per service | backend (`api`), worker (`worker`) | Which half of the backend a container runs; not read from `.env` |
| `JWT_SECRET` | required | backend, worker | Signs access tokens (32+ random characters) |
| `CREDENTIAL_ENCRYPTION_KEY` | empty → `JWT_SECRET` | backend, worker | Encrypts PI/connector credentials at rest |
| `CORS_ORIGIN` | `http://localhost:8070` | backend | Browser origins allowed to call the backend port directly |
| `AUDIT_REQUEST_LOG_RETENTION_DAYS` | `30` | worker (passed to backend too) | Days the audit request log (`audit_logs`) is kept by the daily retention job (04:00); empty = keep forever |
| `AUDIT_TRAIL_RETENTION_DAYS` | `30` | worker (passed to backend too) | Days the append-only audit trail (`audit_log`) is kept; empty = keep forever |
| `RAW_RETENTION_DAYS` | `365` | worker (passed to backend too) | Days of raw source observations (`raw_observations`) kept: whole monthly partitions older than the window are dropped (owner decision 2026-10-15: 1 year); empty = keep forever |
| `SAMPLE_RETENTION_DAYS` | `90` | worker (passed to backend too) | Days of signal samples (`measurement_samples`) kept: whole monthly partitions older than the window are dropped (owner decision 2026-10-15: 90 days); signal summaries are kept; empty = keep forever |
| `RETENTION_BATCH` | `1000` | worker (passed to backend too) | Rows deleted per statement by the retention job |
| `PI_SERVER` | empty | frontend | Target of the `/piwebapi` proxy; empty = `/piwebapi` answers 404 (opt-in, e.g. `PI_SERVER=https://<pi-host>:<port>`) |
| `VITE_API_BASE_URL` | `/api` (build arg) | frontend build | Where the bundle sends API calls; leave relative unless the backend is on another host |

Do not add `VITE_*` keys to the root `.env`: Vite reads that file too, and `VITE_API_BASE_URL=/api` would make
`npm run dev` call the Vite dev server, which has no `/api` proxy. Pass a build-time override on the command line
instead:

```bash
VITE_API_BASE_URL=https://api.example.com/api docker compose build frontend
```

Runtime settings of the frontend container (`BACKEND_URL`, `PI_SERVER`, `CLIENT_MAX_BODY_SIZE`) are rendered into
the nginx config by the image entrypoint on every start, so they can be changed without rebuilding. Every response carries
`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` and `Referrer-Policy: strict-origin-when-cross-origin`.

## Using the shared `instrumental-postgres` container

Local development uses the `proact` database inside the shared `instrumental-postgres` container. To run the
containers against that same data instead of the bundled Postgres:

```bash
# POSTGRES_PASSWORD in .env must be that container's password (DB_PASSWORD in server/pro-act-backend/.env)
docker compose -f docker-compose.yml -f docker-compose.external-db.yml up -d --build
```

The override attaches the backend and worker to the external `instrumental-network`, sets
`DB_HOST=instrumental-postgres`, and parks the bundled `postgres` service behind a profile so it is not started. Use
the same `-f` flags for `ps`, `logs`, `down`, etc.

## Using the shared Kafka cluster and `mosquitto` broker

The host also runs `mosquitto` (eclipse-mosquitto 2.x, ports 1883/8883) and has the `instrumental-kafka-1..3` +
`instrumental-zookeeper` containers (cp-kafka 7.5.0, ZooKeeper mode) on `instrumental-network`. By default Compose
brings up its own single-node `kafka` and `mqtt` so the stack is self-contained (decision D10). To reuse the shared
containers instead:

```bash
docker start instrumental-zookeeper instrumental-kafka-1          # the shared cluster is usually stopped
docker compose -f docker-compose.yml -f docker-compose.shared-infra.yml up -d --build
# both overrides together: shared database + shared brokers
docker compose -f docker-compose.yml -f docker-compose.external-db.yml -f docker-compose.shared-infra.yml up -d --build
```

The override parks `kafka` and `mqtt` behind the `bundled-infra` profile, attaches backend, worker and `kafka-ui`
to `instrumental-network`, and sets `KAFKA_BROKERS=instrumental-kafka-1:9092` and `MQTT_URL=mqtt://mosquitto:1883`
(override either in `.env`). The shared brokers advertise themselves as `kafka-1:9092` etc., which resolves on that
network. Both `kafka` services cannot listen on host port 9092 at the same time; the bundled one is the one to
re-map (`KAFKA_PORT`).

## Profiles

| Profile | Services | Enabled by |
|---------|----------|------------|
| (none) | frontend, backend, worker, postgres, kafka, mqtt | `docker compose up -d` |
| `tools` | kafka-ui | `docker compose --profile tools up -d kafka-ui` |
| `bundled-db` | postgres | only used by `docker-compose.external-db.yml` to park the bundled database |
| `bundled-infra` | kafka, mqtt | only used by `docker-compose.shared-infra.yml` to park the bundled brokers |

## Data, uploads and maintenance

* Database files live in the `proact_postgres-data` volume, uploaded evidence/attachments in `proact_uploads`,
  report export files (plan 2.9, private, never served under `/uploads`) in `proact_exports`,
  Kafka logs in `proact_kafka-data` and MQTT retained messages/sessions in `proact_mqtt-data`.
  `docker compose down` keeps them; `docker compose down -v` deletes them.
* Retention (owner decisions 2026-10-14 and 2026-10-15): the worker's daily job (04:00, `src/common/retention/`)
  deletes audit request-log and audit-trail rows older than 30 days, oldest first in batches of `RETENTION_BATCH`,
  and drops whole monthly partitions of raw source observations older than 1 year (`RAW_RETENTION_DAYS`) and of
  signal samples older than 90 days (`SAMPLE_RETENTION_DAYS`). A partition goes only when its whole month is
  older than the window, so the current month is never touched; signal summaries and approved ledgers are not
  affected. The job logs how many rows and which partitions it removed
  (`docker compose logs worker | grep Retention`). The `audit_log` trigger still refuses every UPDATE and every
  DELETE that is not below the job's declared cutoff. A value that is not a whole number of days ≥ 1 is logged
  as an error and nothing is deleted. Without Docker the job reads the same variables from
  `server/pro-act-backend/.env`; unset there means keep forever, so add
  `RAW_RETENTION_DAYS=365` and `SAMPLE_RETENTION_DAYS=90` there to apply the owner windows.
* Backup / restore the bundled database:
  ```bash
  docker compose exec -T postgres pg_dump -U postgres proact > proact.sql
  docker compose exec -T postgres psql -U postgres proact < proact.sql
  ```
* The maintenance CLIs from `server/pro-act-backend/scripts/` are compiled into the image under `dist/scripts/`:
  ```bash
  docker compose exec backend node dist/scripts/seed-demo-users.js
  docker compose exec backend node dist/scripts/ensure-roles-tasks.js
  ```
* After code changes: `docker compose up -d --build` rebuilds only what changed (dependency layers are cached as
  long as the lockfiles are untouched).
* Logs: `docker compose logs -f backend` (or `worker`, `frontend`, `postgres`, `kafka`, `mqtt`).
* Kafka from the host: `kafka-topics --bootstrap-server localhost:9092 --list` (or `docker compose exec kafka kafka-topics --bootstrap-server kafka:29092 --list`).
  MQTT from the host: `mosquitto_sub -h localhost -p 1884 -t 'proact/#'`.

## Broker users and TLS (dev only)

The bundled broker keeps the anonymous listeners for everyday development and adds, for the MQTT adapter tests
(plan 1.8 step 4), two authenticated listeners that behave like a plant broker (OT contract §1: password, TLS,
read-only ACL). Everything under `docker/mosquitto/` is committed and **public**: use these users and certificates
only against this Compose stack.

| Item | Value |
|------|-------|
| Password listener | `mqtt://localhost:1885` (container `mqtt:1885`), no anonymous access |
| TLS listener | `mqtts://localhost:8885` (container `mqtt:8883`), TLS 1.2+, no client certificate required; same users and ACL |
| CA to trust | `docker/mosquitto/certs/dev-ca.crt`; the server certificate's SAN lists `localhost`, `mqtt`, `proact-mqtt-1`, `host.docker.internal`, `127.0.0.1`, `::1` |
| `proact-test` / `proact-test-dev` | read-only on `proact/#` and `test/#` (what a Pro-Act subscriber gets on the plant broker) |
| `proact-sim` / `proact-sim-dev` | read-write on `proact/#`, `test/#`, `spike/#` (the simulated gateway, `npm run mqtt:sim`, and the persist-before-ack spike) |

```bash
# from the host (mosquitto clients) or inside the container with -h mqtt -p 1885 / --cafile /mosquitto/config/certs/dev-ca.crt -p 8883
mosquitto_sub -h localhost -p 1885 -u proact-test -P proact-test-dev -t 'proact/#' -v
mosquitto_pub -h localhost -p 8885 --cafile docker/mosquitto/certs/dev-ca.crt -u proact-sim -P proact-sim-dev -t test/x -m hi
```

* Regenerate the certificates (10-year validity, or to change the SAN): `sh docker/mosquitto/gen-dev-certs.sh`, then
  `docker compose restart mqtt`. Needs `openssl` on the host (Git Bash has one); the script header shows the
  container alternative.
* Change or add a user: hash it inside the container (`docker compose exec -T mqtt sh -c 'printf "user:pass\n" > /tmp/pw && mosquitto_passwd -U /tmp/pw && cat /tmp/pw'`),
  paste the line into `docker/mosquitto/passwd`, add its `user` block to `docker/mosquitto/acl`, `docker compose restart mqtt`.
* `mosquitto.conf` uses `per_listener_settings true` (deprecated in 2.1, removed in 3.0) because it is the only way
  to keep 1883 anonymous while 1885/8883 check the password file; mosquitto logs the deprecation at start.
  The bind-mounted password file is world-readable on Windows hosts; mosquitto 2.1 warns and 3.0 will refuse it.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `docker compose up` refuses to start with `Set POSTGRES_PASSWORD in .env` | `.env` is missing or incomplete; copy `.env.example` |
| Backend restarts in a loop | `docker compose logs backend`; usually wrong `DB_*` values or the database is not reachable |
| Frontend loads but API calls fail with 502 | Backend not healthy yet (`docker compose ps`), or `BACKEND_URL` points elsewhere |
| 401 after rebuilding | `JWT_SECRET` changed; log in again |
| Uploads return 404 | Uploads are stored in the `proact_uploads` volume; it is removed by `down -v` |
| Port already allocated | Local dev servers (8070/4004), another Postgres (5433) or the host's `instrumental-kafka-1` (9092) are running; change the `*_PORT` values |
| Worker never becomes healthy | `docker compose logs worker`; it needs the same `DB_*`/`JWT_SECRET` as the API and the API must be healthy first |
| Kafka restarts in a loop after a config change | KRaft metadata in `proact_kafka-data` belongs to the old `CLUSTER_ID`/listeners; `docker compose down -v` (dev data only) |

## CI

`.github/workflows/ci.yml` runs on pushes to `main`, pull requests and manual dispatch, on Node 24 with
`npm ci --legacy-peer-deps` in both projects:

| Job | What runs | Notes |
|-----|-----------|-------|
| `lint` | `npm run lint` (frontend), `eslint` without `--fix` (backend) | `continue-on-error` while the ~2400 pre-existing frontend errors are paid down |
| `unit` | backend `npm run test:unit` + `npm run test:fixtures` (Jest `unit` and `fixtures` projects), frontend `npm run test:run` | `src/test/integration/*` is excluded: it needs a live backend |
| `integration` | backend `npm run test:int:ci` (Jest `integration` project, `*.int-spec.ts`) against a `postgres:15-alpine` service container; the harness creates `proact_test` and enables `uuid-ossp` | `DB_*` env points at the service container |
| `e2e` | backend + frontend production builds, migrations + demo users, Playwright Chromium smoke (`auth`, `tasks`, `audit-auto-log` specs) | `continue-on-error` until stable; the HTML report is uploaded as the `playwright-report` artifact |

The e2e job keeps `playwright.config.ts` in charge of starting both servers and only swaps the commands through
`E2E_FRONTEND_COMMAND` / `E2E_BACKEND_COMMAND` (`vite preview` and `node dist/src/main.js`).

Locally, `npm run ci` (→ `scripts/ci.ps1` on Windows, `scripts/ci.sh` elsewhere) runs the same lint, unit and
integration steps sequentially against the local Postgres from `server/pro-act-backend/.env`; add `-- --e2e` for the
smoke suite (uses the dev servers on 8070/4004, starting them if needed) and `--skip-lint|--skip-unit|--skip-int`
to narrow a run.

## Production notes

Production install: see `deploy/vm/VM-STEPS.template.md` (offline bundle, Traverse Forge compose
`deploy/docker-compose.forge.yml`, database scripts under `deploy/db/`, variables in `deploy/BUILD-VARS.md`).
The compose files in this guide are for development only.

* Put TLS termination (a reverse proxy or load balancer) in front of the `frontend` container and drop the
  `BACKEND_PORT` mapping if the API should not be reachable directly.
* The bundled `kafka` and `mqtt` services are development conveniences: single broker, no authentication, anonymous
  MQTT (the authenticated listeners use committed, public dev credentials and a self-signed certificate).
  Point `KAFKA_BROKERS` / `MQTT_URL` at managed brokers in production and run the worker as its own
  deployment (scale the API independently; keep exactly one migration runner).
* Schema changes are versioned migrations (`npm run migration:generate|run|revert|show` in the backend, see
  `server/pro-act-backend/src/database/MIGRATIONS.md`). Entity auto-synchronisation is disabled everywhere.
* Generate unique `POSTGRES_PASSWORD`, `JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` values per environment.

## Run the containers against the development database (demo data)

`docker-compose.devdb.yml` points the backend and worker at the local development database
(`proact-postgres` on the host's 5432, with the demo personas and showcase data) and parks the
bundled postgres. Secrets come from `server/pro-act-backend/.env` at start-up (nothing is stored
in the file). From Git Bash at the repo root:

```bash
export DEV_DB_PASSWORD=... DEV_JWT_SECRET=... DEV_CREDENTIAL_ENCRYPTION_KEY=...   # values of DB_PASSWORD, JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY in server/pro-act-backend/.env
docker compose -f docker-compose.yml -f docker-compose.devdb.yml up -d --build
```

Stop any local `npm run dev` / `npm run start:dev` first (they hold 8070 / 4004). The app is then
http://localhost:8070 (nginx) with the API at http://localhost:4004/api. MQTT connections stored in
that database must use `mqtt://host.docker.internal:1884` (reachable from containers and the host),
not `localhost`.

### Playwright e2e against the containerised API

The integration specs start their test endpoints (the PI Web API simulator, the MQTT simulated
gateway) on the host, while the API that connects to them runs in a container. Tell the specs which
address the container should use; nothing needs setting when the API runs on the host
(`npm run start:dev`).

| Variable | Default | Used by | Meaning |
|----------|---------|---------|---------|
| `E2E_PI_SIM_HOST` | `127.0.0.1` | `e2e/integration-console-ux06.spec.ts`, `e2e/personas/integration-02-pi-ux06.spec.ts` (`e2e/test-utils/pi-simulator.ts`) | Host name the API uses for the PI simulator (`http://<host>:<ephemeral port>/piwebapi`). Set `host.docker.internal` for a containerised API |
| `E2E_PI_SIM_BIND` | `0.0.0.0` if `E2E_PI_SIM_HOST` is not loopback, else `127.0.0.1` | same | Address the simulator listens on |
| `E2E_MQTT_PASSWORD_URL` / `E2E_MQTT_TLS_URL` | `mqtt://localhost:1885` / `mqtts://localhost:8885` | MQTT persona specs (`e2e/personas/support/integration-world.ts`) | Broker URLs the API connects to; `mqtt://host.docker.internal:1885` / `mqtts://host.docker.internal:8885` for a containerised API |
| `E2E_MQTT_SIM_URL` | `E2E_MQTT_PASSWORD_URL` | same | Broker URL the spec's own publisher uses from the host (`mqtt://localhost:1885`) |
| `E2E_MQTT_BROKER_URL` | `mqtt://mqtt:1883` | `e2e/mqtt-console.spec.ts` | Broker URL the API connects to (`mqtt://localhost:1884` for a host-run API) |

`docker-compose.devdb.yml` maps `host.docker.internal` to the host gateway for the backend and the
worker (Docker Desktop resolves it anyway). `CONNECTOR_EGRESS_ALLOWLIST` is empty in development, which
allows every host; if you set it on a dev stack, add `host.docker.internal` to it. Never add
`host.docker.internal` to a production allowlist. With a host-run Playwright and the devdb stack:

```bash
E2E_PI_SIM_HOST=host.docker.internal npx playwright test e2e/integration-console-ux06.spec.ts e2e/personas/integration-02-pi-ux06.spec.ts
```

On Windows the first run may show a firewall prompt for Node listening on all interfaces; allow it on
private networks (the simulator stops when the spec ends).
