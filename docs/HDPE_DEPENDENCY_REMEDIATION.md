# HDPE dependency remediation — 16 October 2026

The previously reported production advisories are cleared in both npm projects. The backend audit is also clear with development dependencies included. The frontend retains one unpatched development-only advisory, propagated through six package entries; this is not six independent vulnerabilities.

## Audit results

| Project / dependency scope | Before | After |
| --- | --- | --- |
| Frontend production | 4 moderate entries | 0 |
| Frontend including development | 16 entries: 10 moderate, 6 high | 6 high entries, all one `braces` advisory |
| Backend production | 8 entries: 4 moderate, 3 high, 1 critical | 0 |
| Backend including development | 51 entries: 16 moderate, 34 high, 1 critical | 0 |

Raw JSON, dependency trees, exact package/lockfile backups, registry metadata, install logs, and before/after dependency deltas are in `test-results/hdpe-followup/`. Audits are registry snapshots, not a claim that all possible dependency defects have been eliminated.

## Changes and compatibility decisions

- Removed unused native `bcrypt` and its types from the backend. Authentication, user management, bootstrap, and seed scripts already import `bcryptjs`; password hashing behavior is unchanged. This removes the vulnerable native installer / `node-pre-gyp` / `tar` chain.
- Removed unused frontend `@nestjs/swagger`, `swagger-ui-express`, and `reflect-metadata`. Searches of application, scripts, tests, and configuration found no consumers. Backend Swagger remains installed and its existing OpenAPI snapshot passes unchanged.
- Updated `react-router-dom` to 7.18.4, fixing the backslash redirect and SSR hydration advisories. The application uses declarative `BrowserRouter` routes. Navigation, capability, and route tests pass; the parent validation campaign owns deployed browser checks.
- Updated `mssql` to 12.7.9 and resolved the patched Tedious chain, removing `sprintf-js`. Legacy SQL Server maintenance scripts remain available. The installed TypeORM version explicitly accepts MSSQL 12. SQL driver construction and parameter binding pass without connecting to a database; no live SQL Server was supplied, so this is not a live SQL Server compatibility certification.
- Kept the existing backend Swagger major and pinned its Lodash child to 4.18.1. Pinned JS-YAML to 4.3.2 across the backend. This also replaces the old JS-YAML 3 / Argparse 1 / `sprintf-js` development chain used by Istanbul's config loader. The loader uses the compatible `load()` API; an actual YAML configuration load passes. A global YAML override avoids npm's false-invalid report when the same patched package is hoisted under multiple scoped overrides.
- Updated Jest to 30.5.2, its types to 30.0.0, and ts-jest to 29.4.15 (which explicitly supports Jest 30). Updated SWC CLI to 0.8.1, removing vulnerable development glob/download chains. Nest's configured build uses TypeScript, and Jest uses ts-jest.
- Updated Vite to 7.3.7, retaining the Rollup build configuration. Replaced the SWC React plugin with `@vitejs/plugin-react` 5.2.0 in Vite and Vitest. The new SWC native loader rejected the Windows cache ancestor ACLs; the supported React plugin resolves the build/test startup issue without ACL changes, native-loader bypasses, or node_modules edits.
- Pinned frontend `postcss-selector-parser` to 7.1.6. The existing Tailwind configuration and CSS output build successfully with the patched parser.

The dependency versions require a modern Node runtime. The tested host and both Docker builds use Node 24. No dependency-wide `audit fix --force` or unrelated package refresh was used.

## Validation

- Backend unit and math fixtures: **220 suites, 2,540 tests passed**, including authentication, scope, and OpenAPI checks (`backend-unit-fixtures-after.json/.log`).
- Frontend navigation / role selection: **154 tests passed** (`frontend-navigation-final.json/.log`).
- Backend typecheck and production build passed (`backend-typecheck-after.log`, `backend-build-after.log`).
- A clean backend `npm ci --legacy-peer-deps --no-audit --no-fund` passed from the final lockfile (`backend-clean-install.log`). `npm ls` validates the selected dependency tree without invalid-package errors.
- The parent's frontend and backend Docker builds also completed successfully with their clean `npm ci` stages (`docker-frontend-build.log`, `docker-backend-build.log`), covering the Linux install/build paths.
- Frontend production build passed (`frontend-build-final.log`).
- Final shared frontend app, node/configuration, and E2E typechecks passed (`session-typecheck-final.log`, supplied by the authentication owner after its concurrent source changes settled).
- Password comparison, absence of unused native bcrypt, SQL Server driver construction and typed request parameters: **9 checks passed** (`dependency-runtime-compatibility.json`).
- Istanbul's actual YAML configuration loader: **3 checks passed** (`nyc-yaml-override-compatibility.json`).
- Final production audits and backend all-dependency audit report zero vulnerabilities. Frontend residual evidence is `frontend-all-final.json` and `frontend-chains-final.json`.

The first SWC-based frontend attempts failed before tests/build execution; their logs are retained as `frontend-navigation-after.log` and `frontend-build-after.log`. They are superseded by the successful final plugin checks. `frontend-typecheck-dependencies.log` retains an earlier failure while shared authentication source edits were underway; the final shared typecheck above supersedes it.

## Remaining development-only issue

`GHSA-vfj7-8cjw-p6xm` affects `braces` through 3.0.3: deeply nested patterns can exhaust the call stack. The registry still reports 3.0.3 as the latest version, with no patched release. Tailwind 3, its Chokidar / Fast-glob / Micromatch parents, and the development-only Lovable tagger account for the six reported entries.

The reviewed application passes static, repository-controlled globs from `tailwind.config.ts` into this build/watch tooling. The affected parser is absent from production dependencies and the deployed frontend serves prebuilt static assets. No path from application API or form input into these glob patterns was found. Malicious build configuration, an untrusted checkout, or developer-supplied glob input remains a risk; this is not marked fixed. Eliminating the chain requires a Tailwind 4 tooling and styling migration or an upstream patch, rather than a compatible patch-level update. That broader migration was deliberately excluded from this remediation.

## Primary evidence

- [React Router redirect advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6) and [SSR hydration advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg).
- [JS-YAML maintainer fix at 4.3.2](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh).
- [Lodash maintainer fix at 4.18.1](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc).
- [MSSQL maintainer release history](https://github.com/tediousjs/node-mssql/releases).
- [Vite migration documentation](https://vite.dev/guide/migration); version 7 was selected to avoid the additional Vite 8 bundler migration.
- Exact npm registry versions, engines, peer contracts, and dependencies: `candidate-registry-metadata.json` and `react-plugin-metadata.json`.
