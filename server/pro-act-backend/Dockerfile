# syntax=docker/dockerfile:1
# Pro-Act backend (NestJS + TypeORM/Postgres).
# Debian (glibc) images provide a consistent build/runtime ABI. The full build
# image includes the node-gyp toolchain for optional native dependencies.

FROM node:24-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
# --legacy-peer-deps: @nestjs/swagger 8.x declares a NestJS 9/10 peer dependency while the app is on NestJS 11;
# the lockfile was produced with legacy peer resolution, so plain `npm ci` fails with ERESOLVE.
# Registry fetches can be slow from this network: retry harder and keep the npm cache between builds.
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000 npm_config_fetch_timeout=600000
RUN --mount=type=cache,target=/root/.npm npm ci --legacy-peer-deps --no-audit --no-fund

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
# scripts/ holds the maintenance CLIs (demo-user seeding etc.). Compiling them alongside src/
# puts the app at dist/src/main.js and the scripts at dist/scripts/*.js.
COPY scripts ./scripts

RUN npm run build && test -f dist/src/main.js && test -f dist/src/worker.js && test -f dist/scripts/seed-demo-users.js
RUN npm prune --omit=dev --legacy-peer-deps


FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4004 \
    WORKER_PORT=4005
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
# Report export logo (assets/marun.png; REPORT_LOGO_PATH overrides it)
COPY --chown=node:node assets ./assets

# Multer writes uploads to ./uploads (relative to the working directory); mount a volume here.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
VOLUME ["/app/uploads"]
# Report export files (plan 2.9): private, never served; shared by the API and the worker via a volume.
RUN mkdir -p /app/storage/exports && chown -R node:node /app/storage
VOLUME ["/app/storage/exports"]

# Role-aware entrypoint and probe (PROCESS_ROLE=api|worker|all, default all). The CR strip guards
# against CRLF checkouts on Windows hosts.
COPY docker/entrypoint.sh docker/healthcheck.js ./docker/
RUN sed -i 's/\r$//' docker/entrypoint.sh && chmod 755 docker/entrypoint.sh

USER node
# 4004 = API (PORT); 4005 = worker health probes (WORKER_PORT)
EXPOSE 4004 4005

# api|all: GET /api/health (public, checks the database); worker: GET /health/ready on WORKER_PORT
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD ["node", "docker/healthcheck.js"]

# api|all -> node dist/src/main.js; worker -> node dist/src/worker.js
ENTRYPOINT ["/app/docker/entrypoint.sh"]
