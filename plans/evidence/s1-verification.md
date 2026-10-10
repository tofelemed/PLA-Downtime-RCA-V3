# S1 finding verification (spec MIG01 / §2.3)

S1 = `docs/DOWNTIME_AND_LOSS_ACCOUNTING_GAP_ANALYSIS.md` (7 Oct 2026). Status values per spec: **confirmed** (reproduced on this checkout), **resolved** (fixed since), **absent** (could not reproduce), **changed** (behaviour differs from S1). "Evidence" is the reproduction used; "code" means confirmed by reading the exact lines, not by execution.

Checkout: working tree over commit `044cc83` (baseline commit pending A1 approval). Backend route inventory: `routes-v1.txt`. Schema: `schema-baseline.sql`.

## Bugs B1–B18

| ID | Finding | Status | Evidence | Target |
|---|---|---|---|---|
| B1 | Event list applies one filter only; `unitId` ignored when `tenantId` present | confirmed | `production-event.controller.ts` L28–44 if-chain (read 7 Oct); `GET /production-events?tenantId&unitId` returns tenant-wide set | G04 → 0.4 |
| B2 | `findByDateRange` uses Mongo `$gte/$lte` | confirmed | `production-event.service.ts` L110–116 | G04 → 0.4 |
| B3 | Reconcile update DTO has `planId/period/categories/tenantId`, not form columns | confirmed | `reconcile-form/dto/update-reconcile-form.dto.ts` printed 7 Oct | G05 → 0.4 (DTO), 2.8 |
| B4 | Loss-category update DTO uses `name` vs column `categoryName` | confirmed | `loss-category/dto/update-loss-category.dto.ts` printed 7 Oct | G05 → 0.4, 2.8 |
| B5 | PI re-sync resets `status` to Open and overwrites edits | **resolved** (1.2, 8 Oct) | was: `pi-event-pull.service.ts` DTO `status: 'Open'` + `update(existing.id, dto)`; now `applySourceRevision` (no status, user overrides kept); T04 in `event-revisions.int-spec.ts`, `pi-event-pull.service.spec.ts` | G02 → 1.2 |
| B6 | Running PI frames stored with `9999-12-31` end | confirmed | no `9999` handling anywhere in `src/integration`, `src/pi-event` (grep) | G01 → 1.1, 1.6 |
| B7 | PI enumeration values become `"[object Object]"` | **resolved** (1.3, 8 Oct) | typed `digital` rules keep `{name, value, isSystem}` in `source_facts`, codes are looked up by Name, `string` rules take the Name; `attribute-mapper.spec.ts`, T05 in `typed-attribute-mapping.int-spec.ts` | G02 → 1.3 |
| B8 | Manual events never save a duration | confirmed | `EventHub.tsx`: `eventForm.duration` initialised/read (L137, 152, 436) but no input or setter writes it | G01 → 1.1, 3.2 |
| B9 | "Calculate from Events" uses hard-coded fake events | confirmed | `PlanDashboard.tsx` L983–1032, literal `quantity: 4200` | G05 → 2.5, 3.5 |
| B10 | Reconcile save drops the selected production event link | confirmed (code) | `PlanDashboard.tsx` ~L721–804 recreates categories without `productionEventId` | G05 → 2.8, 3.5 |
| B11 | PLA trend period selector unwired | confirmed | `PLADashboard.tsx` L962 uncontrolled Select, L982 `groupBy="day"` | G07 → 3.6 |
| B12 | Reason-code `parentId` not persisted | **resolved** (1.3, 8 Oct; backend) | `reason_codes.parent_id` FK + `path`/`level`, v2 tree API with cycle check and retire; T18 in `code-libraries.int-spec.ts`. The v1 reason-code DTO/UI still do not send a parent; the v2 tree UI (3.8, 10 Oct: `/codes-admin`, reparent by picker and drag, Playwright T18 UI) persists it | G06 → 1.3 |
| B13 | `production_losses` DTOs omit `lossType/lossCategory/quantity/cost/description` | confirmed (DTO) | `production-loss/dto/*` | G05 → 0.4 |
| B14 | `unmapped-events` controller has no auth guard | confirmed | `routes-v1.txt` guard=N for `unmapped-event.controller.ts` (also `rca-recommendation`, `dashboard-configuration`, `file-upload`, `app`, `health`) | G04 → 0.4 |
| B15 | Status rules lose functions on save → Event Hub throws | **resolved** (3.8, 10 Oct) | was: `AdminPanel.tsx` `new Function` + `JSON.stringify`; now: the Admin Panel editor and its localStorage rules are deleted (the tab points to Codes & rules), v1 `EventHub.tsx` uses only its built-in status rules; declarative rules are JSON validated and evaluated by the server (`/v2/rules`, `declarative-rules.int-spec.ts`, `codes-admin-hygiene.test.ts`, Playwright T22) | G08 → 3.8 |
| B16 | IOW trend silently shows random data | confirmed (code) | `EventHub.tsx` ~L2388–2439 `Math.random()` fallback | G07 → 3.2 |
| B17 | `reasonCode`/`rca` relations stripped from event reads | confirmed | `production-event.service.ts` relations comment "Removed 'rca', 'reasonCode'" | G04 → 0.4 |
| B18 | `CreateProductDto` rejects `tenantId/unitId` | confirmed (DTO) | `product/dto/create-product.dto.ts` fields: name, code, unitOfMeasure, description, standardCost | G04 → 0.4 |

## Ingestion gaps I1–I16

| ID | Finding | Status | Evidence | Target |
|---|---|---|---|---|
| I1 | Re-sync overwrites user work | **resolved** (1.2, 8 Oct) | same as B5; source vs override conflicts open review items instead of overwriting | G02 → 1.2 |
| I2 | No sentinel handling for running frames | confirmed | same as B6 | G01 → 1.6 |
| I3 | Duration attribute-only, no unit/TimeSpan parsing, not derived | confirmed (code) | `pi-event-mapper.ts` `Number(val)` list includes `duration`; no `(end−start)` at ingestion | G01 → 1.1, 1.3 |
| I4 | Enumeration objects lost | **resolved** (1.3, 8 Oct) | same as B7 | G02 → 1.3 |
| I5 | No `Downtime` type / planned-unplanned flag | confirmed | `AppEventType` union in `pi-event-mapper.ts`; entity has no class column | G01 → 1.1 |
| I6 | Asset-only mapping loses unit and blocks `af_bindings` fallback | **resolved** (1.3, 8 Oct) | asset targets (mappings and AF bindings) resolve to the asset's unit in the same tenant; AF bindings are tier 4 of one resolver; T05 + preview tests | G02 → 1.3 |
| I7 | Wildcard patterns never match PI backslash paths | **resolved** (1.3, 8 Oct) | `normalizePath` on both rule and sample (`\\` and `/` alike, case-insensitive); `mapping-resolver.spec.ts`, `source-mapping.int-spec.ts` | G02 → 1.3 |
| I8 | No paging; >500 frames skipped; watermark always advances | confirmed (code) | `pullEvents` single request `maxCount`; `upsertWatermark` after loop regardless of errors | G03 → 1.6 |
| I9 | Unmapped PI events never reprocessed; assign flow cannot handle them | confirmed (code) | `unmapped-event.service.ts` no replay; `PlanDashboard.tsx` L1180 early return on missing `event.id` | G02 → 1.5, 3.7 |
| I10 | Frontend mapping defaults disagree with backend; whole-template override | **resolved** (1.3, 8 Oct) | one catalog (`contracts/event-field-catalog.json`, drift test) feeds backend defaults and `PIMapper.ts`; overrides merge per target field | G02 → 1.3 |
| I11 | No server-side counter/totalizer ingestion | confirmed | no module writes time-series; `historian_tags` CRUD only | G03 → 1.7 |
| I12 | `pi-browser` request DTO lacks validators → every body rejected under `forbidNonWhitelisted` | **confirmed (runtime)** | `POST /api/pi-browser/{tenant}/request {"path":"/assetservers","method":"GET"}` with a valid token → 400 "property path should not exist, property method should not exist…" (7 Oct 21:53Z) | G08 → 1.6 |
| I13 | One HTTP call per attribute; all plans loaded per event | confirmed (code) | `fetchEventFrameAttributes`; `findPlanForEvent` | G03 → 1.6 |
| I14 | Tenant timezone never read; UTC buckets; browser-local display | confirmed | grep `timezone` in backend: entity only; `toISOString().slice(0,10)` in reporting | G08 → 2.1 |
| I15 | Sync-job UI drops `templateName/maxCount`; `stopSync` no-op; one job per tenant | confirmed (code) | `src/services/pi/AutoPIEventSyncService.ts` `serializeSyncJobExtras`, `stopSync` | G03 → 1.6, 3.7 |
| I16 | Non-PI sources stubbed | confirmed (code) | `unified-event-pull.service.ts` returns `'… not yet implemented'` for OPC UA/Modbus/MQTT/Database/REST | G03 → 1.8, 1.9, R2 |

## Additional verified items not in S1 numbering
| Finding | Status | Evidence | Target |
|---|---|---|---|
| RCA create/update from UI rejected with 400 (field-name mismatch) | confirmed | `POST /api/rcas` with frontend-shaped body → 400 listing `teamMembers`, `tenantId`, `organizationId` should not exist (7 Oct) | 3.9 |
| `POST /auth/register` public, accepts any role incl. SuperAdmin | confirmed | used to create the first admin on 7 Oct | 0.4 |
| Error filter returns stack traces in body | confirmed | `HttpExceptionFilter` response includes `stack` (seen in 400 responses) | 0.4 |
| Frontend unit tests: 6 of 16 failing | confirmed | `tests-baseline.md` | 0.3 |

## Pending runtime checks
- B10: reproduce through the UI with Playwright once a plan and loss row exist (frontend-only defect; API cannot exercise it). Scheduled with the 3.5 regression suite; does not block 0.1 since the code path is unambiguous.

## PI server reachability (D02 input)
`GET https://87.107.103.198:7443/piwebapi` (no credentials, TLS verification off) → HTTP 400 in 0.77 s: host and PI Web API answer; authentication and AF scope still needed.
