# syntax=docker/dockerfile:1
# Pro-Act frontend: Vite build served by nginx.
# nginx also reverse-proxies /api, /uploads and /socket.io to the backend (see docker/nginx/),
# so the app is built with a same-origin API base URL ("/api") by default.

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# --legacy-peer-deps: react-chrono 2.9 declares a React 19 peer dependency while the app is on React 18;
# the lockfile was produced with legacy peer resolution, so plain `npm ci` fails with ERESOLVE.
# Registry fetches can be slow from this network: retry harder and keep the npm cache between builds.
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000 npm_config_fetch_timeout=600000
RUN --mount=type=cache,target=/root/.npm npm ci --legacy-peer-deps --no-audit --no-fund

COPY . .

# Baked into the bundle at build time. "/api" means "same origin" (nginx proxies it to the backend).
# Override only when the backend is served from another host: --build-arg VITE_API_BASE_URL=https://api.example.com/api
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build


# Non-root nginx (uid 101 "nginx", listens on 8080). Its entrypoint still renders
# /etc/nginx/templates/*.template with envsubst into /etc/nginx/conf.d/.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Release identity (deploy/BUILD-VARS.md)
ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="traverse-forge-frontend" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.revision="$GIT_COMMIT" \
      org.opencontainers.image.created="$BUILD_DATE"

# Rendered to /etc/nginx/conf.d/default.conf by the image entrypoint (envsubst on *.template)
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Runtime settings consumed by the nginx template. PI_SERVER empty = /piwebapi answers 404 (opt-in).
ENV BACKEND_URL=http://backend:4004 \
    PI_SERVER= \
    CLIENT_MAX_BODY_SIZE=25m \
    APP_VERSION=$APP_VERSION \
    GIT_COMMIT=$GIT_COMMIT

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
