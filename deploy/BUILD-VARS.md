# Traverse Forge — build arguments and runtime variables

Images: `traverse-forge-backend:${FORGE_VERSION}` (API and worker) and `traverse-forge-frontend:${FORGE_VERSION}`
(nginx, non-root uid 101, listens on 8080). The tag is never `latest`.

## Build arguments

| Argument | Image | Source | Effect |
|---|---|---|---|
| `FORGE_VERSION` | both (tag) | `git describe --tags --always`, or `$(date +%Y%m%d)-$(git rev-parse --short HEAD)` | Image tag; also passed as `APP_VERSION` |
| `APP_VERSION` | both | `= FORGE_VERSION` (default `dev`) | `ENV APP_VERSION`, label `org.opencontainers.image.version` |
| `GIT_COMMIT` | both | `git rev-parse --short HEAD` (default `unknown`) | `ENV GIT_COMMIT`, label `org.opencontainers.image.revision` |
| `BUILD_DATE` | both | `date -u +%Y-%m-%dT%H:%M:%SZ` (default `unknown`) | label `org.opencontainers.image.created` |
| `VITE_API_BASE_URL` | frontend | default `/api` (same origin through nginx) | Baked into the bundle |

Label `org.opencontainers.image.title` is `traverse-forge-backend` / `traverse-forge-frontend`.

```bash
FORGE_VERSION="$(git describe --tags --always)"
GIT_COMMIT="$(git rev-parse --short HEAD)"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker build -t "traverse-forge-backend:$FORGE_VERSION" --build-arg "APP_VERSION=$FORGE_VERSION" \
  --build-arg "GIT_COMMIT=$GIT_COMMIT" --build-arg "BUILD_DATE=$BUILD_DATE" server/pro-act-backend
docker build -t "traverse-forge-frontend:$FORGE_VERSION" --build-arg "APP_VERSION=$FORGE_VERSION" \
  --build-arg "GIT_COMMIT=$GIT_COMMIT" --build-arg "BUILD_DATE=$BUILD_DATE" .
```

## Runtime variables

All runtime variables live in one env file on the VM (`$FORGE_HOME/.env`, template `deploy/.env.example`).
It is used twice:

1. `--env-file` — interpolation of `deploy/docker-compose.forge.yml` (`FORGE_VERSION`, `FORGE_UI_PORT`,
   `PG_NETWORK`, `PI_SERVER`, `CLIENT_MAX_BODY_SIZE`, `FORGE_ENV_FILE`).
2. `env_file: ${FORGE_ENV_FILE:-.env}` — the backend and worker containers' environment. A relative path is
   resolved against the compose **project directory**, so production runs compose with
   `--project-directory "$FORGE_HOME"` (then `.env` is `$FORGE_HOME/.env` whichever release folder holds the
   compose file), or sets `FORGE_ENV_FILE` to an absolute path.

The compose file fixes these per service, overriding the env file:

| Service | Fixed variables |
|---|---|
| backend | `PROCESS_ROLE=api`, `PORT=3000`, `DB_MIGRATIONS_RUN=false` |
| worker | `PROCESS_ROLE=worker`, `WORKER_PORT=4005`, `DB_MIGRATIONS_RUN=false` |
| frontend | `BACKEND_URL=http://traverse-forge-backend:3000`, `PI_SERVER=${PI_SERVER:-}` (empty: `/piwebapi` answers 404), `CLIENT_MAX_BODY_SIZE=${CLIENT_MAX_BODY_SIZE:-26m}` |

The frontend container gets no env file (it needs no secrets). Images report `APP_VERSION` and `GIT_COMMIT`
in their environment.

## Compose commands

Production (on the VM, from `$FORGE_HOME`):

```bash
docker compose --project-directory "$FORGE_HOME" --env-file "$FORGE_HOME/.env" \
  -f "$FORGE_HOME/releases/$FORGE_VERSION/docker-compose.forge.yml" up -d
```

Rehearsal on a workstation with a bundled throwaway `postgres:15-alpine` (`forge-rehearsal-pg`, host
`127.0.0.1:55436`, network `forge-rehearsal-pgnet`; set `DB_HOST=forge-rehearsal-pg` in the rehearsal env):

```bash
docker compose --project-directory deploy --env-file <rehearsal env> \
  -f deploy/docker-compose.forge.yml -f deploy/docker-compose.local.yml up -d
```
