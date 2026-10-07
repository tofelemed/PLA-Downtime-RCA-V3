# syntax=docker/dockerfile:1
# Pro-Act backend (NestJS + TypeORM/Postgres).
# Debian (glibc) images are used because several dependencies ship native addons
# (bcrypt, sqlite3, serialport); the full image in the build stage provides the
# node-gyp toolchain in case a prebuilt binary is unavailable.

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

RUN npm run build && test -f dist/src/main.js && test -f dist/scripts/seed-demo-users.js
RUN npm prune --omit=dev --legacy-peer-deps


FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4004
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# Multer writes uploads to ./uploads (relative to the working directory); mount a volume here.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
VOLUME ["/app/uploads"]

USER node
EXPOSE 4004

# /api/health is public and checks the database connection
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4004) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/src/main.js"]
