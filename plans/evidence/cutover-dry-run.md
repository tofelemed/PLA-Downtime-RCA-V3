# Cutover report (plan 3.10)

Database `proact`, generated 2026-10-10T11:03:21.418Z. **Read-only / dry run** — every query ran in a `READ ONLY` transaction; nothing was written. Scope: all tenants.

Latest migrations: `MigrationCutover1793225600000`, `RcaLinks1793139200000`, `DeclarativeRules1793052800000`. 3.10 bookkeeping tables present.

## Tenants, flags and freeze

| tenant | name | units | events | plans | flags on | v1 write freeze |
| --- | --- | --- | --- | --- | --- | --- |
| 5f011848-1cb5-4b7c-b75a-8938b46260a9 | Demo Plant | 120 | 386 | 33 | v2.codesAdmin, v2.downtimeAnalysis, v2.eventHub, v2.integrationConsole, v2.plaAnalytics, v2.planDashboard, v2.plansProfilesCalendars, v2.rca | no |
| 3d961b95-da1e-425c-af75-575039327155 | E2E Test Tenant 1791471012407-1jgapae | 1 | 1 | 0 |  | no |
| c56d38a0-8199-4ab3-ae01-6deb08837bf9 | E2E Test Tenant 1791557229561-yvrzfds | 1 | 1 | 0 |  | no |
| f7e584be-f7f5-4311-b030-ac8fe6b80334 | E2E Test Tenant 1791608602549-e8tm2l2 | 1 | 1 | 0 |  | no |
| f8f744ad-e2c0-415e-a963-51bcab31e0e6 | E2E Test Tenant finance | 0 | 0 | 0 | v2.codesAdmin | no |

## Pilot scope (A5: plant HDPE, unit100–unit500)

| pilot unit | unit id | tenant |
| --- | --- | --- |
| unit100 |  |  |
| unit200 |  |  |
| unit300 |  |  |
| unit400 |  |  |
| unit500 |  |  |

## Row inventory (null = table absent)

| table | rows |
| --- | --- |
| production_events | 389 |
| production_losses | 0 |
| reconcile_forms | 0 |
| loss_categories | 0 |
| oee_summaries | 3 |
| production_plans | 38 |
| products | 63 |
| units | 123 |
| reason_codes | 204 |
| impact_codes | 5 |
| oee_codes | 7 |
| source_hierarchy_mappings | 0 |
| af_bindings | 0 |
| pi_connections | 0 |
| pi_sync_jobs | 0 |
| pi_sync_watermarks | 0 |
| pi_events | 0 |
| unmapped_events | 2 |
| rca_trigger_configs | 1 |
| rcas | 22 |
| app_settings | 1 |
| event_revisions | 514 |
| event_coding | 499 |
| code_versions | 236 |
| source_mappings | 2 |
| integration_connections | 2 |
| ingestion_exceptions | 2 |
| plan_versions | 33 |
| production_periods | 622 |
| loss_lines | 431 |
| calculation_runs | 575 |
| accounting_revisions | 559 |
| feature_flags | 9 |
| migration_reports | 0 |
| migration_review | 0 |
| legacy_id_crosswalk | 0 |
| legacy_reported_values | 0 |
| migration_explanations | 0 |
| legacy_write_freezes | 0 |

## Remediation jobs (§18.2) — dry run

| job | findings | would change rows | would add review items | would add crosswalk | would add legacy values |
| --- | --- | --- | --- | --- | --- |
| references | TENANT_UNRESOLVED (production_plans): 5 | — | TENANT_UNRESOLVED: 5 | — | — |
| sentinels | — | — | — | — | — |
| durations | — | — | — | — | — |
| duplicates | — | — | — | — | — |
| legacy-values | values: 12, values of oee_summaries: 12 | — | — | — | oee_summaries: 12 |
| links | — | — | — | — | — |
| periods | labels: 3 | — | — | period_day: 9 | — |
| reason-tree | reasonCodes: 204, withParent: 72 | — | — | — | — |
| rates | — | — | — | — | — |
| units | UOM_MISSING (products): 63, EVENT_COST_CURRENCY_MISSING (production_events): 3, EVENT_QUANTITY_UOM_MISSING (production_events): 1 | — | UOM_MISSING: 63, EVENT_COST_CURRENCY_MISSING: 3, EVENT_QUANTITY_UOM_MISSING: 1 | — | — |

## Follow-ups of earlier sub-phases

### 1.1 event backfill (re-run `scripts/report-event-backfill.ts` on the data host for the full report)

| events | sentinels converted | sentinels remaining | durations unit unknown | tenant not uuid |
| --- | --- | --- | --- | --- |
| 389 | 0 | 0 | 0 | 0 |

### 1.2 revisions (events without any revision row = never touched since 1.2; baseline written on first change)

| events | without revision | no source revision |
| --- | --- | --- |
| 389 | 0 | 385 |

### 1.3 code libraries (v1 create / edit does not write code_versions; tenant-less codes unusable)

| library | codes | without tenant | without version baseline |
| --- | --- | --- | --- |
| reason | 204 | 0 | 0 |
| impact | 5 | 0 | 5 |
| oee | 7 | 0 | 7 |

### 1.5 v1 PI connections mirrored into integration_connections

| pi_connections | mirrored | tenant not uuid |
| --- | --- | --- |
| 0 | 0 | 0 |

### 2.3 v1 plans bridged to plan versions

| plans | no scenario | no plan version | no unit reference |
| --- | --- | --- | --- |
| 38 | 5 | 5 | 5 |

### 2.4 / 2.5 / 2.7 compatibility views (v1 readers)

| production_losses_v | loss_categories_v | oee_summaries_v |
| --- | --- | --- |
| 622 | 68 | 559 |

### 3.1 app_settings (global table, no tenant column — the fix is 3.11)

| key prefix | keys |
| --- | --- |
| plantSelection | 1 |

### D08 valuation policies (approval is the owner’s finance decision)

| tenant | version | currency | state |
| --- | --- | --- | --- |
| Demo Plant | 1 | XXX | not approved |
| Demo Plant | 2 | IRR + USD | approved 2026-10-10 09:23 UTC by manager@acme.com |
| E2E Test Tenant 1791471012407-1jgapae | 1 | XXX | not approved |
| E2E Test Tenant 1791471012407-1jgapae | 2 | IRR + USD | not approved |
| E2E Test Tenant finance | 1 | IRR + USD | not approved |
| E2E Test Tenant finance | 2 | IRR + USD | not approved |
| E2E Test Tenant finance | 3 | IRR + USD | not approved |
| E2E Test Tenant finance | 4 | IRR + USD | not approved |


## MIG04 comparison (v1 vs v2, epsilon 1e-6, no balancing adjustments)

### Demo Plant

Compared values: 190 — equal 136, explained 0, **unexplained 54** → gate **FAIL**.

Differences (first 40):

| metric | scope | v1 | v2 | delta | status | explanation |
| --- | --- | --- | --- | --- | --- | --- |
| plan_actual | E2E PD plan 089a3a8f |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 089a3a8f |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 10d2685a |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 10d2685a |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 1fbc7d87 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 1fbc7d87 |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 202e55e8 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 202e55e8 |  | 180 |  | unexplained |  |
| plan_actual | E2E PD plan 2485f0ac |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 2485f0ac |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 279c4015 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 279c4015 |  | 180 |  | unexplained |  |
| plan_actual | E2E PD plan 33507871 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 33507871 |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 39733a09 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 39733a09 |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 3c31067a |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 3c31067a |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 3d2c9d7b |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 3d2c9d7b |  | 180 |  | unexplained |  |
| plan_actual | E2E PD plan 3f1c922e |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 3f1c922e |  | 180 |  | unexplained |  |
| plan_actual | E2E PD plan 436cee3f |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 436cee3f |  | 180 |  | unexplained |  |
| plan_actual | E2E PD plan 645fdbd2 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 645fdbd2 |  | 180 |  | unexplained |  |
| plan_actual | E2E PD plan 6659037c |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 6659037c |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 6716bf84 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 6716bf84 |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 8cbd7565 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 8cbd7565 |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan 9348941a |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan 9348941a |  | 180 |  | unexplained |  |
| plan_actual | E2E PD plan a0b82221 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan a0b82221 |  | 90 |  | unexplained |  |
| plan_actual | E2E PD plan b7209df7 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan b7209df7 |  | 270 |  | unexplained |  |
| plan_actual | E2E PD plan b9072a04 |  | 2550 |  | unexplained |  |
| plan_losses | E2E PD plan b9072a04 |  | 270 |  | unexplained |  |

### E2E Test Tenant 1791471012407-1jgapae

Compared values: 1 — equal 1, explained 0, **unexplained 0** → gate **PASS**.

### E2E Test Tenant 1791557229561-yvrzfds

Compared values: 1 — equal 1, explained 0, **unexplained 0** → gate **PASS**.

### E2E Test Tenant 1791608602549-e8tm2l2

Compared values: 1 — equal 1, explained 0, **unexplained 0** → gate **PASS**.


## Appendix — CLI dry runs on `proact` (same day, nothing written)

Commands (Demo Plant `5f011848-1cb5-4b7c-b75a-8938b46260a9`): `npx ts-node scripts/cutover/cutover.ts flags-on --tenant 5f011848-1cb5-4b7c-b75a-8938b46260a9 --screens all`, `… freeze --tenant 5f011848-1cb5-4b7c-b75a-8938b46260a9`, `… flags-off --tenant 5f011848-1cb5-4b7c-b75a-8938b46260a9 --screens all`. All 8 v2 flags are already on for Demo Plant, so the switch-over is a no-op there; the rollback dry run lists the 8 flag rows it would switch off, in reverse cutover order. The per-row detail of every remediation job: `npx ts-node scripts/cutover/remediate.ts --job all`.

```
Database: proact
[DRY RUN] cutover:flags-on (tenant: 5f011848-1cb5-4b7c-b75a-8938b46260a9) — nothing written
  findings:        requested: 8, alreadyAtTarget: 8
  would change rows:     —
  review items:    —
  crosswalk:       —
  legacy values:   —
Database: proact
[DRY RUN] cutover:freeze (tenant: 5f011848-1cb5-4b7c-b75a-8938b46260a9) — nothing written
  findings:        —
  would change rows:     insert legacy_write_freezes: 1
  review items:    —
  crosswalk:       —
  legacy values:   —
    insert legacy_write_freezes <new id>: null → {"tenant_id":"5f011848-1cb5-4b7c-b75a-8938b46260a9","reason":"cutover to v2","frozen_by":"(dry run)","frozen_at":"<now>"}
Database: proact
[DRY RUN] cutover:flags-off (tenant: 5f011848-1cb5-4b7c-b75a-8938b46260a9) — nothing written
  findings:        requested: 8
  would change rows:     update feature_flags: 8
  review items:    —
  crosswalk:       —
  legacy values:   —
    update feature_flags 1bac4dc2-f31a-4422-8cfd-05695e1a0427: {"enabled":true} → {"enabled":false}
    update feature_flags b7da5d44-0438-4eb1-942f-4db2b1c5c7b9: {"enabled":true} → {"enabled":false}
    update feature_flags 2ea42399-dcf1-4d56-a42e-823a0930056a: {"enabled":true} → {"enabled":false}
    update feature_flags f8cdac0a-1b23-4eb9-9d6a-948130e7132e: {"enabled":true} → {"enabled":false}
    update feature_flags 8c2bbe0d-f9fd-4420-a6ce-3312718346f1: {"enabled":true} → {"enabled":false}
    update feature_flags a1381462-a09a-4e5b-b1cd-21c61e0363ce: {"enabled":true} → {"enabled":false}
    update feature_flags 113f3bb6-5cd9-4cdd-bfc1-4b8889db32a2: {"enabled":true} → {"enabled":false}
    update feature_flags d7a3d5c2-48a5-4522-8bef-835252d42c0e: {"enabled":true} → {"enabled":false}
```
