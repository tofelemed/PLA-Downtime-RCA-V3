# Decision Register — please fill in

How to use: for each item tick an option (`[x]`) or write under **Answer**. If you don't know yet, tick **"Use the proposed default for now"** — the plan proceeds on that default and the gate column says when a real answer is needed. Leave **Confirmed by / date** for the person who owns the decision. I will not start Phase 1+ design work that depends on an item until it has either an answer or an explicit "use default".

Legend — *Gate*: the sub-phase where the decision becomes irreversible without rework.

---

## A. Working agreements (needed before I start coding)

### A1. Git workflow
- [ yes and you will merge ] Commit directly to `main` (small, frequent commits)
- [ ] Feature branch per sub-phase (`phase-0.3-migrations`), merged by me when tests pass
- [ ] Feature branch per sub-phase, **you review and merge** (PR)
- **Baseline commit:** may I commit the current working tree (~430 files: Postgres migration, Docker files, docs, plans) as the Phase 0.1 baseline? [ ] yes [ ] no, I'll do it

yes do it 
- **Answer:**
- Confirmed by / date:

### A2. Running servers
- [ ] I may start/stop the local dev servers and Docker containers as needed (backend/frontend/Kafka/MQTT/Postgres)
- [ ] Ask each time
- **Answer:**

### A3. New dependencies (ENGINEERING_STANDARDS forbids adding without asking). Approve the list I expect to need:
| Package | Purpose | Sub-phase | Approve? |
|---|---|---|---|
| `luxon` | IANA timezone + DST-correct calendar generation | 2.1 | [ ] |
| `decimal.js` | exact decimal arithmetic for quantities/money | 1.7, 2.5 | [ ] |
| `ajv` | JSON Schema validation of envelopes/policies/rules | 1.5, 0.2, 3.8 | [ ] |
| `kafkajs` (or `@confluentinc/kafka-javascript`) | Kafka client | 1.9 | [ ] |
| `fast-check` | property-based tests (interval algebra, replay invariance) | 1.1, 1.5 | [ ] |
| `openapi-typescript` | generated typed v2 client | 3.1 | [ ] |
| `@tanstack/react-virtual` | virtualized lists | 3.1 | [ ] |
| `rollup-plugin-visualizer`, `size-limit` | bundle budget in CI | 3.1 | [ ] |
| `@nestjs/throttler` | rate limiting (429) | 0.4 | [ ] |
| `compression` | API response compression | 3.11 | [ ] |
| `@willsoto/nestjs-prometheus` (or OpenTelemetry SDK) | metrics | 3.12 | [ ] |
| `openid-client` | OIDC SSO | 3.11 | [ ] |
| `k6` (CLI, not npm) | load tests | 3.11 | [ ] |
| Remove: `react-flow-renderer` (duplicate of `reactflow`), `install`, `node-opcua-*` from the **frontend** package | bundle hygiene | 3.1 | [ ] |
- **Answer / exclusions:**
add them 
### A4. Demo data
- [ ] Keep the existing seeders (cement / oil & gas / presentation) but only in a demo environment flag
- [yes do this  ] Replace with new seeders that exercise the real path (periods, rates, loss lines)
- [ ] Drop demo data entirely
- **Answer:**

### A5. Pilot scope (spec MIG03)
- Which **site/plant, unit and product** will be the pilot? Is a real PI server reachable from this machine, and who holds its credentials?
- **Answer:**
Plant: HDPE 
unit : use unit100, unit200, ...... , unit500
---

## B. Spec decisions D01–D15

### D01 — Code/build baseline *(Owner: engineering lead · Gate: 0.1)*
Proposed: this repository at commit `044cc83` + uncommitted work is the baseline; the NestJS/Postgres backend exists but is CRUD-only (verified).
- [ ] Confirmed [ ] Something else exists (describe)
- **Answer:** yes commit an dpush 
- Confirmed by / date:

### D02 — PI Web API installation *(Owner: PI administrator · Gate: 1.6 certification)*
Please provide or confirm:
1. PI Web API version and base URL; authentication mode (Basic / Kerberos / Bearer); who provides credentials; is a service account available?
2. AF database and element scope(s) to monitor.
3. **Event frame templates** actually used and their attribute names. Our defaults: `Production Loss` (Description, ReasonCode, OEECode, ImpactCode, Quantity, Cost, Shift, Crew, Duration, LossCategory, OperatorName), `IOW Deviation`, `SOL Violation`, `APM Alert`, `Failure WO`, `Production Output` (GoodQty, ScrapQty).
4. How an **open (still running) event frame** is represented — we assume `EndTime = 9999-12-31T23:59:59Z`.
5. Are reason/state values stored as **enumeration sets (digital states)**?
6. Which **tags** give production actuals: output event frames, totalizers (counters), or rate tags? Units and timebase (e.g. t/h).
7. Does the installation offer a change feed / archive corrections? Are deletions of event frames possible?
8. Polling cadence allowed (default 60 s) and historical backfill depth you want (default 90 days).
- **Answer:**
we already have web api - also sdk 
- Confirmed by / date:

### D03 — Calendars, shifts, crews, timezone *(Owner: operations · Gate: 2.1)*
Proposed default: one site per tenant; IANA timezone from the plant setting; operational day starts **06:00** local; **3 × 8 h shifts** (06–14, 14–22, 22–06); **shift is the accounting leaf**, day and month are roll-ups; crews are a separate rotation.
1. Timezone(s) of the pilot plant(s): ______
2. Operational day start: ______
3. Shift pattern (names, start/end, days): ______
4. Accounting leaf: [ ] shift [ ] day only
5. Holidays / planned shutdown handling: [ ] excluded from scheduled time [ ] counted as planned downtime inside schedule
6. Crews: [ ] fixed per shift [ ] rotating pattern (describe) [ ] not tracked
- [ ] Use the proposed default for now
- **Answer:**
time zone is irani - tehran 
other thing use by industry standrd 
- Confirmed by / date:

### D04 — Baselines and OEE policy *(Owner: production owner · Gate: 2.5 / 2.7 fixture sign-off)*
Proposed default: compute **both** ledgers; the **plan ledger** is the default view; **planned stops inside scheduled time reduce availability**; schedule exclusions only via the calendar; derates count as **performance** loss; micro-stops < 60 s count as performance, ≥ 60 s as availability.
1. Default view: [ ] plan ledger [ ] capacity ledger [ ] both side by side
2. Planned maintenance inside the schedule: [ ] reduces availability (ISO 22400 default) [ ] excluded from scheduled time
3. Derate (reduced rate) counts as: [ ] performance [ ] availability (fractional)
4. Micro-stop threshold: ______ seconds (default 60)
5. Quantity basis for time losses: [ ] sustained capacity rate for capacity ledger and planning rate for plan ledger (default) [ ] other
6. Do you also want the **GE-style reconciled OEE** tile? [ ] yes [ ] no
- [ ] Use the proposed default for now
- **Answer:**
as per standard 
- Confirmed by / date:

### D05 — Authoritative actuals and gross/good boundary *(Owner: production/metrology lead · Gate: 2.4)*
Proposed default: PI **Production Output event frames** are primary; totalizer delta is fallback; `good = gross − rejects`; rework counts as good only when accepted.
1. Primary source per unit/product: [ ] PI output EFs [ ] PI totalizer [ ] PI rate integration [ ] MQTT counter [ ] manual entry
2. Where is "good" measured (accounting boundary)? ______
3. Are rejects/rework recorded? Where? ______
4. Is a Maximo daily production report available for import (statuses COMPLETED/RELEASED)? [ ] yes [ ] no
5. Coverage gate for approval: [ ] 100 % accepted coverage (default) [ ] other: ______
- [ ] Use the proposed default for now
- **Answer:** based on proposed and standard 
- Confirmed by / date:

### D06 — Approval roles and tolerance *(Owner: operations control · Gate: 2.8 UAT)*
Proposed default: roles per spec §13.2 (operator, production engineer, manager approver, reliability engineer, integration admin, master data admin, viewer); **submitter ≠ approver**; **tolerance zero** (epsilon 1e-6); no "Unaccounted" classification allowed; one approver.
1. Who submits? ______ Who approves? ______ Second approver required? [ ] yes [ ] no
2. Tolerance: [ ] zero [ ] percent of plan: ___ % [ ] absolute: ___ units
3. May a period be approved with an explicit "Unaccounted" line? [ ] no (default) [ ] yes, with reason
4. Who may initiate a **revision** of an approved period? ______
5. Map existing roles: SuperAdmin → ___, OrgAdmin → ___, TenantAdmin → ___, Manager → ___, Analyst → ___, Engineer → ___, Operator → ___
- [ ] Use the proposed default for now
- **Answer:** based on proposed and standard 
- Confirmed by / date:

### D07 — Estate size and service objectives *(Owner: platform lead · Gate: 3.11)*
Proposed: spec §17.1 targets (10 sites, 200 units, 2 000 assets, 10 000 signals, 100 users, 1 000 obs/s).
1. Real numbers for your estate: sites ___ units ___ assets ___ signals ___ users ___
2. Signal cadence (e.g. 1 s, 10 s): ___ Typical payload size: ___
3. Retention: raw ___ samples ___ ledgers/audit ___ (default 1 y / 90 d / 7 y)
- [ ] Use the proposed default for now
- **Answer:** use one plant and unit i provided earlier in this doc 
- Confirmed by / date:

### D08 — Valuation *(Owner: finance · Gate: 2.6)*
Proposed default: **contribution margin** per product for commercial opportunity; **standard cost** as a separately named view; cost per hour from impact codes for operational cost; single currency per tenant; no FX until a policy exists.
1. Default basis: [ ] contribution margin [ ] standard cost
2. Currency per tenant: ______ Multi-currency needed? [ ] yes [ ] no
3. `products.standard_rate` today — is it a **cost per unit** or a **production rate**? ______ (we will not reuse it until you say)
4. Joint-product boundary (if co-products exist): ______
- [ ] Use the proposed default for now
- **Answer:** use as proposed
- Confirmed by / date:

### D09 — MQTT *(Owner: OT integration · Gate: 1.8 certification)*
Proposed default: Mosquitto (dev); QoS 1; persistent sessions; topic `enterprise/site/unit/asset/signal`; JSON payload with `ts`, `seq`, `bootId`, `id`, `value`, `unit`, `quality`.
1. Production broker(s), TLS and auth method: ______
2. Topic naming convention actually used: ______
3. Payload format: [ ] JSON (fields: ______) [ ] Sparkplug B [ ] other
4. Do payloads carry event time and a sequence number? [ ] yes [ ] no
5. Expected outage buffering window: ___ hours (default 24)
- [ ] Use the proposed default for now
- **Answer:** its done we will do it in end - we already have mqtt runing 
- Confirmed by / date:

### D10 — Kafka *(Owner: streaming platform · Gate: 1.9 certification)*
Proposed default: local cp-kafka 7.5 cluster for dev; topics `pla.raw.v1`, `pla.normalized.v1`, `pla.event.changed.v1`, `pla.period.recalculate.v1`, `pla.period.approved.v1`, `pla.deadletter.v1`; JSON; RF 1 dev / RF 3 prod.
1. Production cluster owner and security (TLS, SASL/mTLS, ACLs): ______
2. External source topics to consume and their format (JSON / Avro / Protobuf + registry): ______
3. May ProAct create its internal `pla.*` topics? [ ] yes [ ] no, provisioned by platform team
- [ ] Use the proposed default for now
- **Answer:**its done we will do it in end - we already have kafka runing 
- Confirmed by / date:

### D11 — Historical data and migration rules *(Owner: data owner · Gate: 3.10)*
Proposed default: no destructive reset; expand-and-contract; remediation rules from spec §18.2; existing `reconcile_forms`/`loss_categories` migrated read-only to loss lines (the DB holds demo data only today).
1. Is there any real production data in any environment we must preserve? [ ] no, demo only [ ] yes (where): ______
2. Legacy `duration` values — were they entered in minutes? [ ] yes [ ] hours [ ] mixed/unknown
3. Approved reason-code tree to import (file)? [ ] yes (attach) [ ] start flat
4. Old reconcile data: [ ] migrate as "UnknownLegacy" [ ] discard (demo)
- [ ] Use the proposed default for now
- **Answer:** proposed default 
- Confirmed by / date:

### D12 — Downstream systems *(Owner: enterprise integration · Gate: 2.9)*
Proposed default: R1 delivers signed webhook + Kafka republish of `PeriodApproved` and CSV/PDF exports; Maximo/CMMS exchange documented, delivered in R2.
1. Data lake / BI target and format: ______
2. CMMS/Maximo instance and what should flow (work orders in? approved losses out?): ______
3. Is email export required by any site? [ ] no [ ] yes, recipients/scope: ______
- [ ] Use the proposed default for now
- **Answer:**
we will decide it later - leave it in end 
- Confirmed by / date:

### D13 — Failure taxonomy, repair evidence, RCA thresholds *(Owner: reliability lead · Gate: 2.7 / 3.9)*
Proposed default: a **functional failure** = `FailureWO` event or unplanned stop with a failure code; MTTR shown as "mean downtime to restore" until repair start/end evidence exists; RCA recommended when confirmed downtime ≥ 60 min or cost ≥ threshold or repeated failure (3 in 30 days).
1. Failure taxonomy source: [ ] ISO 14224 classes [ ] Maximo failure codes (class/problem/cause/remedy) [ ] own list
2. Is active repair start/end available (from Maximo)? [ ] yes [ ] no
3. RCA trigger thresholds: duration ___ min; cost ___; repeats ___ in ___ days; [ ] auto-create case [ ] recommend only
- [ ] Use the proposed default for now
- **Answer:** added 
- Confirmed by / date:

### D14 — Products, campaigns, value chain *(Owner: process engineering · Gate: 2.3)*
Proposed default: **sequential campaigns** only in R1; concurrent products behind a feature flag; losses reported per unit with a value-chain label to avoid double counting.
1. Do units run more than one product **at the same time**? [ ] no [ ] yes (describe shared capacity): ______
2. Are there upstream/downstream units where the same material would be counted twice? ______
- [ ] Use the proposed default for now
- **Answer:** use propsed 
- Confirmed by / date:

### D15 — Hosting, identity, backup *(Owner: IT owner · Gate: 3.11 / 3.12)*
Proposed default: Docker Compose now; container platform TBD; local JWT auth for dev; OIDC provider TBD; Postgres PITR backups.
1. Target hosting (on-prem VM / Kubernetes / cloud): ______
2. Identity provider for SSO (Azure AD / Keycloak / other) and MFA policy: ______
3. Backup region/retention and support coverage hours: ______
- [ ] Use the proposed default for now
- **Answer:**
- Confirmed by / date:
use just docker , jwt , 
---

## C. Product choices I flagged earlier (not in the spec's register)

### C1. Duration display unit in the UI
Stored as seconds (spec). Display default: [ ] minutes everywhere [ ] hours:minutes [ ] context-dependent (minutes in lists, h:mm in KPIs)
- **Answer:**

### C2. Vertical slice first (spec §20)
Confirm we build **M1** (one PI event frame → event → shift period → loss line → approved revision → export) before broadening to all screens: [ ] yes [ ] no, prefer breadth first
- **Answer:**

### C3. Period accounting location in the UI (UX01)
[ ] Tab on the Plan Dashboard with deep links (default) [ ] separate "Production Accounting" workspace
- **Answer:**

### C4. Legacy screens during migration
[ ] Keep v1 screens behind flags until pilot acceptance (default) [ ] replace immediately per screen
- **Answer:**

---

## D. Confirmation log

Recorded 7 Oct 2026 from the answers above (product owner, via this file). Where an answer says "proposed", "standard" or is blank under the closing "accepted", the proposed default is recorded. Gates still apply: the owner can change a row later and the dependent sub-phases listed in the register are re-reviewed.

| Date | Item | Decision recorded | How I read the answer |
|---|---|---|---|
| 2026-10-07 | A1 Git | Commit directly to `main`; Claude commits and merges. Baseline committed as `913086b`. **Push skipped for these phases** (owner instruction after `origin` returned "repository not found"); local commits only until told otherwise. Implementation work is delegated to subagents per task (owner instruction). | "yes and you will merge", "yes do it", "skip push for these phases", "use agents" |
| 2026-10-07 | A2 Servers | May start/stop local dev servers and containers as needed | left blank → default allowed; say so if you want to be asked |
| 2026-10-07 | A3 Dependencies | All listed packages approved; removals approved | "add them" |
| 2026-10-07 | A4 Demo data | **Replace** seeders with new ones that exercise the real path (periods, rates, loss lines); old seeders retired when 3.1 ships | ticked |
| 2026-10-07 | A5 Pilot | Plant **HDPE**; units **unit100, unit200, unit300, unit400, unit500**; PI Web API and PI SDK exist (credentials/templates still to be provided under D02) | written answer |
| 2026-10-07 | D01 Baseline | Confirmed; baseline commit + push | "yes commit and push" |
| 2026-10-07 | D02 PI | Installation has Web API and SDK; **details 1–8 outstanding** — adapter built against defaults + simulator; certification (1.6) waits for credentials, templates, sentinel confirmation | "we already have web api - also sdk" |
| 2026-10-07 | D03 Calendar | Timezone **Asia/Tehran** (IRST, UTC+3:30, no DST since 2022); operational day 06:00; 3 × 8 h shifts; shift leaf; holidays excluded from scheduled time; crews rotating — all defaults except timezone | "irani - tehran", "industry standard" |
| 2026-10-07 | D04 OEE policy | ISO 22400 defaults: both ledgers, plan ledger default view, planned stops inside schedule reduce availability, derate = performance, micro-stop 60 s, GE reconciled OEE tile **on** (labelled) | "as per standard" |
| 2026-10-07 | D05 Actuals | PI Production Output EFs primary, totalizer fallback, good = gross − rejects, 100 % coverage gate; Maximo import: not confirmed | "based on proposed and standard" |
| 2026-10-07 | D06 Approval | Spec §13.2 roles; submitter ≠ approver; tolerance zero; no Unaccounted line; one approver; legacy role map: SuperAdmin/OrgAdmin → all roles, TenantAdmin/Manager → manager approver, Engineer/Analyst → production engineer, Operator → operator | "based on proposed and standard" |
| 2026-10-07 | D07 Sizing | Dev/pilot sizing = 1 plant, 5 units; §17.1 numbers kept as load-test targets only | "one plant and unit I provided" |
| 2026-10-07 | D08 Valuation | Contribution margin default; standard cost separate view; single currency; `standard_rate` **not reused** until confirmed | "use as proposed" |
| 2026-10-07 | D09 MQTT | Broker already running; **adapter scheduled last** (after Phase 2, before Phase 3 analytics) | "we will do it in end" |
| 2026-10-07 | D10 Kafka | Cluster already running; **source adapter scheduled last**; internal outbox→Kafka transport still built in 1.5/1.9 because realtime/accounting consumers need it | "we will do it in end" |
| 2026-10-07 | D11 Data | Proposed default: no destructive reset, remediation table, demo-only data today | "proposed default" |
| 2026-10-07 | D12 Downstream | Deferred; R1 ships exports + outbox events only | "leave it in end" |
| 2026-10-07 | D13 Reliability | Proposed default (FailureWO/unplanned-with-failure-code = failure; MTTR labelled until repair evidence; RCA ≥ 60 min / repeats 3 in 30 d, recommend-only) | "added" (no values given → defaults) |
| 2026-10-07 | D14 Products | Sequential campaigns; concurrent behind flag | "use proposed" |
| 2026-10-07 | D15 Hosting | **Docker Compose + local JWT only** for R1; OIDC/SSO removed from 3.11 scope; JWT hardened instead (short-lived access, rotated refresh, separate secrets) | "use just docker, jwt" |
| 2026-10-07 | C1 Duration display | Context-dependent default: minutes in lists, h:mm in KPIs, seconds in API | blank → "accepted" |
| 2026-10-07 | C2 Vertical slice | Yes, M1 first | blank → "accepted" |
| 2026-10-07 | C3 Accounting UI | Tab on Plan Dashboard with deep links | blank → "accepted" |
| 2026-10-07 | C4 Legacy screens | Keep v1 behind flags until pilot acceptance | blank → "accepted" |
| 2026-10-08 | 1.1 Legacy status | v1 labels ↔ three states per `src/domain/events/legacy-status.ts`: Open/Coded/RCA Required/Investigating/Completed/Closed/Cancelled are written back; "In Progress" reads as Investigating; Cancelled = retracted; the physical state always follows the interval. Existing labels are not rewritten by the migration (D11) | engineering default under DT11, not yet reviewed by the owner |
| 2026-10-08 | 1.1 Legacy types | ProductionLoss → downtime/availability/full stop; ProductionOutput → production output; every other or unknown type → advisory with no OEE impact (T42) | engineering default under §3.2 / T42 |
| 2026-10-08 | 1.1 Legacy durations | Only PI-sourced legacy `duration` values are assumed minutes; all others are kept in `legacy_duration` with no unit and flagged for review (MIG §18.2: never guessed) | engineering default |
| 2026-10-08 | 1.1 Backfill | Runs as set-based SQL inside the migration (pilot volume, D07) instead of a worker job; pinned to the TS rules by an integration spec | engineering choice |
| 2026-10-08 | 1.2 Source vs user layers | A source re-sync writes only fields whose **source** value changed and that the user has not overridden; overridden fields open a `source_vs_override_conflict` review item and keep the user value. Overrides cover source-owned fields plus the classification axes; reason/impact/OEE codes and workflow states are the user's layer and are never touched by a source (PI-mapped codes are taken at create only) | engineering default under ING06 / §5.3, not yet reviewed by the owner |
| 2026-10-08 | 1.2 Duplicates / retraction | Identical source content is a duplicate (counter only, no revision, ETag unchanged); retraction tombstones (`retracted`, legacy "Cancelled"), never deletes | engineering default under ING01 |
| 2026-10-08 | 1.3 Mapping precedence | Exact source id → exact normalised path → pattern (higher `precedence` first) → approved AF binding (element, then ancestors); a connection-specific rule beats an "any connection" rule; two hits of one tier with different targets are **ambiguous and quarantined**, never resolved by picking one. Paths and patterns: `\\` and `/` are the same separator, case-insensitive; `*` spans separators, `?` one character, `[*]` `[?]` `[[]` literals | engineering default under ING03, not yet reviewed by the owner |
| 2026-10-08 | 1.3 Unresolved codes | A delivered reason/impact/OEE value that matches no code (or two codes) exactly leaves the event **uncoded** with a diagnostic and suggestions; the event itself is not quarantined | engineering default under ING03 (spec says quarantine), not yet reviewed by the owner |
| 2026-10-08 | 1.3 Durations and attributes | PI `Duration` defaults to minutes (as 1.1); TimeSpan text is parsed only under a `timespan` rule; when a supplied duration and the timestamps differ by more than 1 s the timestamps win and `DURATION_MISMATCH` is recorded | engineering default under ING04, not yet reviewed by the owner |
| 2026-10-08 | 1.3 Code libraries | Codes are unique per tenant and library; a change is a new version (history kept), retire ends validity and never deletes, a parent with active children cannot be retired; failure groups follow class → problem → cause → remedy; shared tenant-less codes are no longer accepted on events (left in the DB) | engineering default under §3.2 / NFR01, not yet reviewed by the owner |
| 2026-10-08 | 1.3 Code-driven classification | A reason code proposes schedule class, OEE component and impact code (rule in force at the event start, else the code's defaults); a value the user sends wins and is flagged `overridesDefault` | engineering default under §3.2, not yet reviewed by the owner |
| 2026-10-08 | 1.3 Write roles | Code libraries and code rules: `master_data_admin` or `manager_approver` (TenantAdmin/Manager); source mappings and attribute rules: `integration_admin` or `manager_approver`; reads: any tenant member | engineering default under D06, not yet reviewed by the owner |
| 2026-10-08 | 1.4 Split / merge | Split at an instant strictly inside the event (before now when open) → two children sharing the parent's occurrence and coding; merge only within one unit, same physical type and schedule class unless `overrideClassification`, gap policy default 0 s (≤ 1 day), conflicting non-null coding → 422; contributors and split parents become `superseded` (v1 "Cancelled", not editable), nothing is deleted | engineering default under DT09, not yet reviewed by the owner |
| 2026-10-08 | 1.4 Amounts on split/merge | `quantity` and `cost` are prorated by duration on split (an open parent's amounts go to the running child) and summed on merge, so totals are conserved | engineering default, not yet reviewed by the owner |
| 2026-10-08 | 1.4 Bulk coding | Codes = reason, schedule class, OEE component (reason defaults apply); ≤ 500 events atomic and refused whole on any exclusion; > 500 (max 10 000) → job in chunks of 200, each chunk atomic, job `partial` when some chunks fail | engineering default under DT10 / API04, not yet reviewed by the owner |
| 2026-10-08 | 1.4 Close | End after start and not in the future; on a source-owned event the end is a user override with a `pending_source_confirmation` review item, resolved automatically when the source delivers the same end; a different source end opens a conflict and the override stays | engineering default under DT10 / DT11, not yet reviewed by the owner |
| 2026-10-08 | 1.4 Operation rights | Split, merge, close and bulk coding need tenant (and unit-scope) membership only, as v2 PATCH; role gating comes with the 3.2 UI | engineering default, not yet reviewed by the owner |

### Still needed from you (not blocking Phase 0)
- D02 details: PI Web API base URL, auth mode and a service account; AF database/element scope for HDPE; actual event-frame template and attribute names; which tags hold production actuals for unit100–unit500. Needed before 1.6/1.7 certification.
- **D08 Q2 — currency code** (ISO 4217, e.g. `IRR`, `USD`): the seeded `valuation_basis` policy carries the placeholder `XXX`, so every loss stays "unvalued (policy pending)" and the RCA cost trigger is disabled until this is set. Needed at 2.6.
- D09/D10: broker/cluster endpoints and security when we reach the connector sub-phases.
