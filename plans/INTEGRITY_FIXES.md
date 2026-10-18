# Integrity and connection fixes (from `docs/INDUSTRY_CAPABILITY_ASSESSMENT.md` §0 Q2)

Owner request 2026-10-18: fix the nine integrity and connection issues; RCA runs on v2 for every plant.
Coordination: the UX-remediation session (`plans/UX_REMEDIATION.md`) owns item 9 (loss derivation
disclosure, D-2) and the item 4 link pickers (G-3); its frontend agents hold `src/features/{event-hub,
downtime-analysis,plan-dashboard,month-close,pla-analytics,rca,tasks,shell,analysis-navigation}`,
`src/app/routes`, `src/App.tsx` — frontend parts below wait until they are free.
Per phase: unit tests + typecheck + lint; integration specs on a private `TEST_DB_NAME`. Seed + e2e once
at the end, after asking the owner.

## Backend
- [x] 3 RCA on v2 everywhere: the legacy `rca_trigger_configs` auto-create is removed; RCA triggers and the
      open-event sweep no longer read `v2.rca` (flag default on, no server effect)
- [x] 1 Coding verification / failure validation written as event revisions + outbox `EventChanged`
- [x] 2 RCA field history: every case command writes the append-only `audit_log` (before/after hash,
      changed fields); `GET /v2/rcas/:id/history`
- [x] 5 Recommendation → action → task: `rca_actions.recommendation_id`; task completion flows back to the
      linked action; server-side duplicate guard for case tasks
- [x] 6 In-app reminders: RCA action due / overdue, task due / overdue, uncoded backlog, long open stop
- [x] 7 Typed causes: `rca_causes` (direct / contributing / root, cause code from `rca_cause_codes`,
      evidence links); close gate requires a coded root cause for cases opened after the change
- [x] 8 `coding_default` rules propose classification for MQTT / PI / state-engine events (open axes
      only, `declarative_rule` basis, never over source-owned facts)
- [x] OpenAPI snapshot + `src/api/v2/schema.d.ts` regenerated after the UX session's changes

## Frontend (after the UX session frees its folders)
- [x] 3 RCA policy page: drop the "flag off" alert
- [x] 4 "Start RCA" from loss line, period, Pareto bar, bad actor (uses the `loss_line` link + G-3 pickers)
- [x] 2 RCA case History tab
- [x] 5 Recommendation → action link in the case; task status shown on the action
- [x] 7 Typed cause editor in the case; close readiness shows the coded-root-cause gate
- [x] 6 Notification kinds rendered in the header bell

## Final
- [x] Full lint / typecheck / unit (frontend + backend); integration specs touched
- [x] Integration specs, one file at a time on `proact_integrity_test` (2026-10-18, after the disk reclaim): all pass —
      `rca-triggers` 6, `rca-d17-triggers` 5, `work-reminder-notifications` 6, `sla-reminders` 4, `source-event-rules` 3,
      `typed-attribute-mapping` 4, `source-mapping` 9, `mqtt-state-signal` 2, `rca-history` 3, `rca-action-tasks` 4,
      `rca-causes` 7, `rca-cases` 17, `rca-closure-independence` 4, `rca-knowledge-sharing` 3, `rca-knowledge` 15,
      `rca-workspace` 8, `admin-tasks-audit-v2` 5, `migrations` 6, `tenant-rls` 5, `rls-policy-form` 1 (agents also
      passed `stop-coding-gate`, `event-revisions`, `stop-events`, `declarative-rules`, `analog-state-engine`,
      `reconciliation-sla-notifications`)
- [x] e2e journeys that request RCA closure need a coded root cause step: `e2e/personas/reliability-rca-case.spec.ts`,
      `e2e/personas/reliability-knowledge-base.spec.ts`, `e2e/rca-integration-rca01-03.spec.ts`
- [x] Decisions recorded in `plans/DECISIONS.md`
- [ ] e2e on the real plant setup (owner provides it; `proact` reseeded after owner confirmation) — run by the UX session
