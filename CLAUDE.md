# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
Pro-Act: industrial production-loss accounting, downtime analytics and RCA. Two npm projects in one repo.
- Frontend (repo root): React 18, Vite 5, TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts. Dev server `:8070`.
- Backend (`server/pro-act-backend/`): NestJS 11, TypeORM 0.3, PostgreSQL 15 (`proact` DB in Docker `instrumental-postgres`, port 5432), Socket.IO. API `:4004`, prefix `/api`. Must run on 4004 (`PORT=4004` in its `.env`).
- Plan of record: `plans/README.md` (phase checklist), `plans/SPEC_ANALYSIS.md`, `plans/ENGINEERING_STANDARDS.md`. Business logic: `docs/PROACT_APPLICATION_GUIDE.md`. Verified gaps: `docs/DOWNTIME_AND_LOSS_ACCOUNTING_GAP_ANALYSIS.md`. Other `*.md` under `server/pro-act-backend/` are stale.

### Layout
- `src/pages/` routes · `src/components/` feature UIs (`ui/` = generated shadcn) · `src/services/api/*Api.ts` REST clients over `httpClient.ts` · `src/services/MasterDataService.ts` facade · `src/contexts/` Auth + PlantSelection · `e2e/` Playwright · alias `@/` → `src/`.
- Backend: one folder per feature under `src/` (`*.module/controller/service/entity.ts`, `dto/`); `src/common/` filters/middleware; `src/auth/` guards; `scripts/` maintenance CLIs; `test/` fixtures and e2e.

### Commands
```
# frontend (root)                    # backend (server/pro-act-backend)
npm ci --legacy-peer-deps            npm ci --legacy-peer-deps
npm run dev                          npm run start:dev
                                     npm run start:worker:dev # worker only (PROCESS_ROLE=api|worker|all, default all; worker health :4005)
npm run build                        npm run build
npm run lint                         npm run lint
npm run typecheck                    # app + unit tests + e2e + configs (root tsconfig.json alone checks nothing)
npm run test:run                     npm test                 # Jest *.spec.ts
npx vitest run <file>                npx jest <file>
npm run test:e2e                     npm run db:seed-demo-users
npx playwright test e2e/<spec>       npx tsc --noEmit -p tsconfig.json   # typecheck
npm run ci [-- --e2e]                # local CI: lint + typecheck + unit + integration (+ e2e smoke), same steps as .github/workflows/ci.yml
```
Docker: `cp .env.example .env` → `docker compose up -d --build` (see `docs/DOCKER.md`). Health `GET /api/health`; Swagger `/api`. Logins: `test@example.com` / `Test123!@#`, `*@acme.com` / `demo123`.

## Size limits (unless splitting makes the code harder to follow)
- Files ≤ 400 lines (hard stop 500). Split by responsibility.
- Functions ≤ 40 lines, ≤ 4 parameters. React components ≤ 150 lines; extract hooks/subcomponents.
- One main export per file; one responsibility per module; nesting depth ≤ 3; prefer early returns.
- Existing oversized files (`EventHub.tsx`, `PlanDashboard.tsx`, `RCAModule.tsx`): don't grow them; move new code into `features/<area>/` modules.

## Code style
- TypeScript strict; no `any` — use `unknown` and narrow. Named exports. camelCase vars, PascalCase components/classes, kebab-case files.
- No commented-out code, unused imports, or `console.log` (use the Nest `Logger` / a frontend logger).
- Follow the patterns in neighbouring files before inventing new ones; reuse `src/components/ui/*` and existing services.

## Architecture rules
- Backend layering: controller → service → repository; no DB access in controllers; business rules live in services/domain modules, never in the browser.
- Validate at the boundary with DTOs. The global `ValidationPipe` is `whitelist + forbidNonWhitelisted`: any undeclared field returns 400, so DTOs and frontend payloads must match exactly.
- Auth: global `APP_GUARD` chain (`JwtAuthGuard` → `RolesGuard` → `ScopeGuard`); routes are protected unless `@Public()` (and listed in the route-guard allowlist test). Backend tenant/scope come from `RequestContext` (`@Ctx()`), never a query param; v2 queries start with `scopedQuery()`. Resolve tenant as `plantSelection?.tenant?.id || session?.tenant?.id` in the frontend.
- Errors: use Nest exceptions; the filter shapes the response. Never return stack traces to clients.
- Config and secrets only from env (`.env` files are git-ignored). Never hardcode URLs, ports, keys.
- Database: Postgres column types only (`varchar`, `text`, `timestamptz`, `boolean`, `numeric`); `numeric` is parsed to JS number by `app.module.ts`. Schema comes from migrations (`src/database/migrations`, conventions in `src/database/MIGRATIONS.md`); `synchronize` is off. Every schema change is a migration with `down`.
- Time: store UTC `timestamptz`, half-open intervals, durations in seconds; tenant timezone for display.
- Audit: a global interceptor logs mutating requests; send `X-Client-Audited: true` if the client already logged the action.
- `src/services/StorageService.ts` (IndexedDB) is legacy — never use it for new features.

## Performance rules (full list: `plans/ENGINEERING_STANDARDS.md`)
- Index every filtered/joined/sorted column and FK; check `EXPLAIN ANALYZE` for new query shapes.
- No N+1 queries; paginate every list endpoint (keyset on big tables); select only needed columns; bulk insert/upsert.
- Cache only with a TTL and a stated invalidation path; keys include tenant.
- Slow work → worker job + `202`; timeouts and retries with backoff on every external call.
- Frontend: lazy-load routes and heavy components (charts, diagrams, editors); virtualize long lists; TanStack Query for all fetching; never load a tenant's full event list to compute KPIs.

## Workflow
- Read the relevant files before editing; don't guess line numbers from docs.
- Smallest change that solves the task; no unrelated refactors. Plan first when touching > 3 files; follow `plans/` for spec work and tick its checklists.
- Add or update tests for new logic (fixtures for maths, integration for queries, e2e for journeys). Run lint, typecheck and tests before declaring done; report failures verbatim.
- Ask when requirements are unclear instead of assuming; record product decisions in `plans/DECISIONS.md`.

## Don'ts
- Don't add dependencies without asking.
- Don't edit `.env*`, applied migrations, generated files (`src/components/ui/*`, generated API types), or `node_modules`.
- Don't change public API contracts (routes, DTOs, response shapes) without flagging it and updating the OpenAPI snapshot (`npm run openapi:v2:update` → `server/pro-act-backend/openapi/v2.json`).
- Don't put fabricated or random data in product code (no heuristic KPIs, `Math.random` fallbacks, demo defaults). Demo data belongs in isolated seeders.
- Don't compute business numbers in the browser or write to the server on page render.

<!-- claude-reflect: learned rules (saved from the band; edit freely) -->
## Learned rules
- When changing a plant setting such as date or time format, apply the change everywhere that setting is displayed in the app.
- Treat the MQTT feed as owned by the data engineering team; Pro-Act only subscribes to it and does not handle the PI-to-MQTT publishing.
- Default the plant week start to Saturday, since Iran's weekend is Thursday and Friday, not Monday.
- Display monetary amounts in USD by default, with a user option to switch the display to IRR.
- Before seeding data or running full plant end-to-end tests, check with the user first and wait for their go-ahead.
<!-- end claude-reflect -->
