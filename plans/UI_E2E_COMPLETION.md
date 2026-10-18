# Complete the single-extruder UI workflow

Owner authorization: 17 October 2026, following the UI coverage review. Preserve existing SuperAdmin changes and unrelated working-tree edits.

## Implementation sequence

- [x] Consolidate Users, Permissions and Delegations into one User Management workspace. Preserve capability checks, URL state and old deep links. Keep plant/branding/configuration tools in their related administration area.
- [x] Route MQTT state-format observations into versioned state signals; retain availability/Last Will semantics, quality, timestamps and replay idempotency.
- [x] Expose MQTT Signals navigation, correct source-key hints, and connect setup to Source Priority and Unit State.
- [x] Expose stop-engine settings and the existing non-writing derived-event preview.
- [x] Add production-output quantity and slowdown impact inputs to manual event forms.
- [x] Add per-shift manual plan target entry and preserve targets when editing/copying versions.
- [x] Complete reduced-hours holidays using explicitly entered shift windows, not guessed percentages.
- [x] Verify/fix rate-signal quantity units and provide clear UI guidance.
- [x] Add setup readiness/sample validation using real configuration and backend evidence; keep broker connectivity distinct from accounting readiness.
- [x] Update stale SuperAdmin help text and the E2E guide.
- [x] Run type checks, focused unit/component and isolated integration tests, OpenAPI/schema checks and builds. Do not seed or run full live-plant E2E without separate authorization.

## Validation and delivery

Record final checks and remaining limitations here. Existing live deployment is Docker project `proact` with `docker-compose.yml` plus `docker-compose.devdb.yml`, serving 8070/4004. The separate 8071/4006 deployment is unrelated.


17 October 2026 validation:
- Frontend typecheck and full frontend lint pass (lint retains existing warnings).
- Focused frontend regression: 27 files, 194 tests pass, covering administration/navigation, new workspace routing and role gates, MQTT forms/sample preview, manual event evidence, plan targets and calendars.
- Backend typecheck and targeted ESLint pass; focused unit regression: 25 suites, 397 tests pass, including MQTT decoder/handler behavior, source quality, accounting, rate units, holiday/DST generation and OpenAPI snapshot.
- Isolated PostgreSQL regression: 2 tests pass on `proact_test`, proving saved-profile packet validation without raw writes and tenant isolation, real state packet intake, late-state retention, delivery deduplication, sample quality, non-writing derived preview and idempotent derived-event creation.
- OpenAPI regenerated and frontend generated type parity check passes. No additional database migration is required for the holiday JSON field or UI/API additions.
- Main Docker backend/frontend builds pass. Recreated only main `proact` backend, worker and frontend with `--no-deps --no-build`; all three report healthy. API `4004/api/health` and frontend proxy `8070/api/health` return 200 with database connected. Main `proact` database has no pending migrations and `SuperAdminApprovalOverride1794190400000` is applied.
- Deployed frontend entry `/assets/index-CRtCmK2A.js` and User Management, stop-policy and MQTT bundles return 200 and contain the new controls. Backend/worker image `8ed5331c0745af052c19d115fa58778d6d78fa2ca7473a64326eeb49f464aad1`; frontend image `dcb3144b7e96a1c1fbcb132e1077696926c2980eec58d09dc1f752bc1f1533ba`.
- Browser automation timed out, so rendered live-screen visual QA remains unverified. No seeding, broker publishing or full live-plant E2E run was performed.
