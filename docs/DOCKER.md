# Running Pro-Act with Docker

Everything needed to run the platform in containers lives at the repo root:

| File | Purpose |
|------|---------|
| `Dockerfile` | Frontend image: Vite build served by nginx, which also reverse-proxies the backend |
| `docker/nginx/default.conf.template` | nginx config (SPA fallback + proxy for `/api`, `/uploads`, `/socket.io`, `/piwebapi`) |
| `server/pro-act-backend/Dockerfile` | Backend image: NestJS compiled to `dist/`, production dependencies only |
| `docker-compose.yml` | `frontend` + `backend` + bundled `postgres`, with named volumes for data and uploads |
| `docker-compose.external-db.yml` | Override that points the backend at the shared `instrumental-postgres` container instead |
| `.env.example` | Compose settings; copy to `.env` (git-ignored) |

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
| backend | http://localhost:4004/api/health | Swagger UI at http://localhost:4004/api |
| postgres | `localhost:5433` | database `proact`; 5433 because the shared container already uses 5432 |

The host ports come from `FRONTEND_PORT`, `BACKEND_PORT` and `POSTGRES_PORT` in `.env`. The defaults match the
local dev servers, so stop `npm run dev` / `npm run start:dev` first or pick other ports.

On the first boot the backend creates the schema from the TypeORM entities (`DB_SYNCHRONIZE=true`), which takes
a little while; `docker compose ps` shows the backend as `healthy` once `/api/health` reports the database connected.

## How the pieces fit together

```
browser ──► frontend (nginx :80 → host :8070)
              ├─ /            static Vite build (SPA fallback to index.html)
              ├─ /api         ─┐
              ├─ /uploads      ├──► backend (NestJS :4004 → host :4004) ──► postgres :5432
              ├─ /socket.io   ─┘
              └─ /piwebapi    ──► PI_SERVER (AVEVA PI Web API, same as the Vite dev proxy)
```

The frontend image is built with `VITE_API_BASE_URL=/api`, so the browser talks to the backend through nginx on
the page's own origin. That removes CORS from the picture and means the same image works whatever hostname or IP
the users type. `src/services/api/apiBaseUrl.ts` resolves the REST base URL and derives the Socket.IO URL from it.

nginx resolves `BACKEND_URL` at request time via Docker's DNS, so it starts even if the backend is still booting
and follows the backend container across restarts.

## Configuration

All settings are read by `docker compose` from `.env` (or the shell environment).

| Variable | Default | Used by | Meaning |
|----------|---------|---------|---------|
| `FRONTEND_PORT` | `8070` | compose | Host port for nginx |
| `BACKEND_PORT` | `4004` | compose | Host port for the API (direct access, Swagger) |
| `POSTGRES_PORT` | `5433` | compose | Host port for the bundled Postgres |
| `POSTGRES_USER` | `postgres` | postgres, backend | Database user |
| `POSTGRES_PASSWORD` | required | postgres, backend | Database password |
| `POSTGRES_DB` | `proact` | postgres, backend | Database name |
| `DB_HOST` / `DB_PORT` | `postgres` / `5432` | backend | Database address as seen from inside the backend container |
| `DB_SYNCHRONIZE` | `true` | backend | Let TypeORM create/alter tables from the entities on boot |
| `JWT_SECRET` | required | backend | Signs access tokens (32+ random characters) |
| `CREDENTIAL_ENCRYPTION_KEY` | empty → `JWT_SECRET` | backend | Encrypts PI/connector credentials at rest |
| `CORS_ORIGIN` | `http://localhost:8070` | backend | Browser origins allowed to call the backend port directly |
| `PI_SERVER` | `https://87.107.103.198:7443` | frontend | Target of the `/piwebapi` proxy |
| `VITE_API_BASE_URL` | `/api` (build arg) | frontend build | Where the bundle sends API calls; leave relative unless the backend is on another host |

Do not add `VITE_*` keys to the root `.env`: Vite reads that file too, and `VITE_API_BASE_URL=/api` would make
`npm run dev` call the Vite dev server, which has no `/api` proxy. Pass a build-time override on the command line
instead:

```bash
VITE_API_BASE_URL=https://api.example.com/api docker compose build frontend
```

Runtime settings of the frontend container (`BACKEND_URL`, `PI_SERVER`, `CLIENT_MAX_BODY_SIZE`) are rendered into
the nginx config by the image entrypoint on every start, so they can be changed without rebuilding.

## Using the shared `instrumental-postgres` container

Local development uses the `proact` database inside the shared `instrumental-postgres` container. To run the
containers against that same data instead of the bundled Postgres:

```bash
# POSTGRES_PASSWORD in .env must be that container's password (DB_PASSWORD in server/pro-act-backend/.env)
docker compose -f docker-compose.yml -f docker-compose.external-db.yml up -d --build
```

The override attaches the backend to the external `instrumental-network`, sets `DB_HOST=instrumental-postgres`,
and parks the bundled `postgres` service behind a profile so it is not started. Use the same two `-f` flags for
`ps`, `logs`, `down`, etc.

## Data, uploads and maintenance

* Database files live in the `proact_postgres-data` volume and uploaded evidence/attachments in `proact_uploads`.
  `docker compose down` keeps them; `docker compose down -v` deletes them.
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
* Logs: `docker compose logs -f backend` (or `frontend`, `postgres`).

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `docker compose up` refuses to start with `Set POSTGRES_PASSWORD in .env` | `.env` is missing or incomplete; copy `.env.example` |
| Backend restarts in a loop | `docker compose logs backend`; usually wrong `DB_*` values or the database is not reachable |
| Frontend loads but API calls fail with 502 | Backend not healthy yet (`docker compose ps`), or `BACKEND_URL` points elsewhere |
| 401 after rebuilding | `JWT_SECRET` changed; log in again |
| Uploads return 404 | Uploads are stored in the `proact_uploads` volume; it is removed by `down -v` |
| Port already allocated | Local dev servers (8070/4004) or another Postgres (5433) are running; change the `*_PORT` values |

## Production notes

* Put TLS termination (a reverse proxy or load balancer) in front of the `frontend` container and drop the
  `BACKEND_PORT` mapping if the API should not be reachable directly.
* Set `DB_SYNCHRONIZE=false` once a migration workflow exists; auto-synchronising entities against a live
  database can drop or rewrite columns.
* Generate unique `POSTGRES_PASSWORD`, `JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` values per environment.
