# Expert Review — Findings Register and SME Questions

**Date:** 13 October 2026 · **Basis:** code at commit `6e02a7c` (read-only review; five parallel reviews, every Critical/High finding re-checked in code). **Not verified live:** the database findings come from reading migrations and queries only (Docker was down; no `EXPLAIN` / `pg_stat` run yet).

**How we work this file:** one area at a time, in the order of the table below.
For each area:
1. SMEs answer that area's questions. Answers then move into [DECISIONS.md](DECISIONS.md).
2. We fix the findings and tick their status here.
3. We re-score the area and move to the next one.

Status legend: ⬜ open · 🔄 in progress · ✅ fixed (commit) · ❎ won't fix (reason)

| # | Area | Maturity (13 Oct) | One line | Status |
|---|---|---|---|---|
| 1 | Loss accounting engine | ~65% | Decimal maths, signed residuals and immutable runs are strong. But the plan ledger is priced at the wrong rate, so ordinary shifts need a manual bridge line to close. | 🔄 SME questions out |
| 2 | Downtime & reliability KPIs | ~60% | Interval maths and aggregation are correct. Wrong definition of what counts as a unit stop, and no equipment state engine. | ⬜ |
| 3 | Reconciliation workflow | ~80% | Hash-bound submit and approve, approved revisions immutable by DB trigger. Separation of duties incomplete. | ⬜ |
| 4 | Valuation | ~65% | Sound mechanics. The reported value is not the approved, reconciled value. | ⬜ |
| 5 | RCA / CAPA | ~40% | Good data model. No server-side closure rules; the analysis tools are mostly data entry. | ⬜ |
| 6 | Database & performance | ~72% | Good modelling. Index strategy for time-window queries and list paging is wrong. | ⬜ |
| 7 | Frontend & UX | ~74% | v2 screens show only server numbers. The feature flags no longer match what users see, and coding a stop takes too many steps. | ⬜ |

Paths below are relative to `server/pro-act-backend/src/` unless prefixed `FE:` (frontend `src/`).

---

## Area 1 — Loss accounting engine (~65%)

### 1.1 Findings

| ID | Sev | Finding | Evidence | Proposed fix | Q | Status |
|---|---|---|---|---|---|---|
| LA-01 | Critical | **Plan ledger prices losses at the profile planning rate, not the rate the plan implies, and never credits catch-up.** When the target is below planning capacity, ordinary shifts come out over-accounted, need a bridge, and are blocked at zero tolerance. *Example:* target 180 t on a 200 t capacity at 25 t/h; a 1 h trip leaves 175 t made, a 5 t gap, but the stop is priced at 25 t, so 20 t over-accounted. Fixture T28 already expects `bridge_or_conflict`. | `domain/accounting/plan-ledger.ts` (`capacityOver(segments,'planning')`, `maxZero(capacity − gross)`); `accounting/accounting-inputs.loader.ts` (`RATES_SQL` ignores `plan_periods.planning_rate_version_id`) | Price at the plan-implied rate (target ÷ eligible time) or emit a typed `plan_rate_difference` line; allow a signed performance/catch-up line; pin the rate version recorded on the plan period | Q1 Q2 Q15 | ⬜ |
| LA-02 | High | **One impossible quality or derate claim fails the whole period run.** The previous run stays current with no end date. | `domain/accounting/capacity-ledger.ts:94-103, 133-142` (`IMPOSSIBLE_CLAIM`); `accounting/accounting-run.service.ts:192-194`; `accounting-runs.int-spec.ts:193-204` | Complete the run, flag `claim_exceeds_component`, route it to reconciliation | Q3 | ✅ 13 Oct (uncommitted; integration test updated, not run: Docker down) |
| LA-03 | High | **Rate or calendar changes never trigger a recalculation.** `ProfileBaselineChanged` is emitted but nothing subscribes; the sweep re-queues only periods with no run or new samples. | `profiles/profile-events.ts:9`; `periods/period-recalc.consumer.ts:50-62`; `periods/period-sweep.job.ts:75-97` | Consume `ProfileBaselineChanged` and calendar publish; enqueue a recompute over the affected range (open periods) or a change proposal (approved) | Q7 | ✅ 13 Oct (uncommitted; unit-tested, no integration test yet) |
| LA-04 | High | **Unexplained loss is reported as slow running.** Capacity minus gross with no cause becomes a performance line flagged `no_cause`; the capacity residual is algebraically always 0. *Example:* a 2 h trip nobody logged shows A 100%, P 75%. | `domain/accounting/capacity-ledger.ts:123-131, 162-165`; `component-lines.ts:254-256` | Label the cause-less remainder `unexplained` in views/KPIs; derive true rate loss from a measured rate signal | Q4 | ⬜ |
| LA-05 | High | **An asset-level or "no impact" stop counts as a full unit stop** (shared with Area 2). | `domain/accounting/segmentation.ts:35-64` (no check of `impactMode`, `oeeComponent`, asset) | Only `full_stop` / unit-level stops reduce capacity; partial = derate fraction; `none` = no quantity loss | Q5 | ⬜ |
| LA-06 | Medium | **Output frames spanning shifts are split by elapsed time and ignore stops.** Proportional split is on by default. *Example:* 300 t over 12 h, split 8 h / 4 h, with a 4 h stop in the first shift: that shift is credited 200 t for 4 running hours. | `domain/actuals/period/output-distribution.ts:151-185`; `periods/policy-bodies.ts:16` | Weight by running time (excluding stops) or book at frame end; prefer counters | Q8 | ⬜ |
| LA-07 | Medium | **Plan target not prorated to the slice window.** Correct only while plan leaves equal production-period bounds; a misaligned leaf gets its full target. | `periods/slice-plan.ts:109-122`; `accounting/accounting-inputs.loader.ts:200-202` | Prorate by eligible time, or reject misaligned leaves | — | ✅ 13 Oct (time share of the plan period) |
| LA-08 | Medium | **No grade-transition, startup or ramp-up model.** HDPE transition off-grade / wide-spec lands in quality or cause-less performance. | grep: no transition/changeover logic in `domain/accounting` | Transition event type and loss category; wide-spec as a separate quality class | Q9 Q10 Q14 | ⬜ |
| LA-09 | Medium | **Concurrent causes share a stop equally.** No primary-cause rule; external (starved/blocked) stops are charged like unplanned ones; no value-chain de-duplication. | `domain/accounting/segmentation.ts:94-110, 210-212, 253-269` | Policy option first-out / hierarchy priority; external class excluded from unit capacity loss | Q11 Q12 Q13 | ⬜ |
| LA-10 | Medium | **Concurrent products double-count capacity.** Each slice uses the full window. Acceptable for R1 per D14 (sequential only). | `domain/accounting/capacity-ledger.ts:155` | Keep the flag off; revisit if D14 changes | Q17 | ⬜ |
| LA-11 | Medium | **Planned stops inside the schedule reduce availability by default, labelled "ISO 22400".** ISO 22400 removes planned downtime from the base (PBT = POT − planned downtime). The D04 answer "as per standard" was applied to a mislabelled option. | `database/migrations/1792534400000-AccountingEngine.ts:138`; `periods/engine-policy-bodies.ts:29`; [DECISIONS.md](DECISIONS.md) D04 item 2 | Re-ask D04 item 2 with the correct label; flip default if SMEs choose the standard | Q6 | ⬜ |
| LA-12 | Low | Conservation check on 8-dp rounded lines vs epsilon 1e-6 may fail spuriously above ~200 lines per slice. | `domain/accounting/conservation.ts:176-211` | Check on unrounded sums, or scale epsilon by line count | — | ✅ 13 Oct (uncommitted) |
| LA-13 | Low | Asia/Tehran correctness depends on Node ICU tzdata ≥ 2022b (DST abolished). Not verified. | `zone-timeline.ts` | Assert tzdata version at startup / in CI | — | ✅ 13 Oct (uncommitted; local Node tz 2025b OK) |
| LA-14 | Low | Dead legacy code with fabricated numbers (`lossValuePerUnit \|\| 100`, fixed unaccounted %). **Unreachable** (`pages/ProductionPlans.tsx` is unrouted), but still in the repo. | FE: `components/production-plans/PlanDashboard.tsx:1800-1889, 3120-3272` | Delete with the Area 7 dead-code clean-up | — | ⬜ |

**Done well (keep):**
- Two baselines (sustained rate for the capacity ledger, planning rate for the plan ledger), segmented at rate-version and schedule edges.
- Signed residuals, never clamped; overproduction, over-accounted and conflict flags are explicit.
- decimal.js engine at 40 significant digits with deterministic remainders.
- Counter rollover and reset handling; null, never zero, on missing data.
- SHA-256 input fingerprint, immutable runs, atomic pointer switch.
- No fabricated numbers in the backend.

### 1.2 Questions for SMEs

Owner key:
- **PA** = production accountant / planning
- **PE** = process engineer
- **OPS** = operations manager
- **MET** = metrology / quality lab

Each question shows the industry standard in one line. Please fill in the **Answer** column. "Standard" is an acceptable answer. Where we already have a related answer in [DECISIONS.md](DECISIONS.md), it is cited.

| Q | Owner | Question | Industry standard (one line) | Answer |
|---|---|---|---|---|
| Q1 | PA | When a plan target is below planning capacity, which rate converts lost time into lost tonnes **in the plan ledger**: (a) the plan's own implied rate (target ÷ eligible time), (b) the profile planning rate plus an explicit "plan slack" line, or (c) the sustained maximum rate? | The plan ledger values time losses at the plan's own implied rate, so plan − actual closes without a balancing entry; the gap to capacity is shown only in the capacity ledger. | |
| Q2 | PA | If a unit runs **above** plan rate after a stop and catches up, should the gain (a) net off the stop's loss, or (b) be shown as a separate "rate gain" line with the stop's loss kept gross? | Report losses gross and gains as a separate line (never net), so every cause stays visible and Σ losses − Σ gains = gap. | |
| Q3 | MET / PA | When a declared off-spec or derate quantity is larger than the measurements can support (e.g. lab says 30 t off-spec, but gross − good is 20 t), should the system (a) block the period calculation, or (b) calculate and flag the claim for reconciliation? | Never block the calculation on one bad input; flag the exception and resolve it in the reconciliation step (data validation and reconciliation practice). | |
| Q4 | PA / PE | Loss that no recorded event explains (capacity − actual with no cause): show it as (a) "performance / slow running", or (b) "unexplained / unaccounted"? Do we have a measured rate tag per unit to prove real slow running? | Speed loss is claimed only against rate evidence; the rest is reported as unexplained/unaccounted until someone explains it. | |
| Q5 | PE / OPS | Which stops reduce **unit** output: (a) only full-unit stops, (b) equipment stops unless a standby takes over, (c) partial stops as a fraction (e.g. one of two trains = 50%)? Which equipment in unit100–unit500 has installed spares? | ISO 14224 classifies each failure's impact on production as total / partial / none; only total counts as unit downtime, partial as a rate fraction, none as zero loss. | |
| Q6 | OPS / PA | A planned stop (PM, cleaning, catalyst change) that the plan already allowed for: should it (a) reduce availability, or (b) be removed from scheduled time and not count as a loss? *(D04 item 2 asked this, but the option labelled "ISO 22400 default" was the wrong one, so the "as per standard" answer needs confirming.)* | ISO 22400: planned downtime is subtracted from the base (PBT = POT − planned downtime); it is not an availability loss. Unplanned overrun of a planned stop is a loss. | |
| Q7 | PA | When a rate (e.g. maximum sustained rate) or a shift calendar is approved **back-dated**, should (a) open periods recompute automatically and approved periods get a change proposal, or (b) changes apply only from today? | Master data is effective-dated; open periods recompute automatically; closed/approved periods change only through a controlled, approved restatement. | |
| Q8 | PE / MET | A production-output record that spans two shifts: split by (a) elapsed time, (b) running time excluding stops, (c) book all at its end time, or (d) use the PI totalizer per shift? Which units have reliable totalizers? | Use measured totalizer deltas per period where available; otherwise pro-rate by running time, never by plain clock time. | |
| Q9 | PE | HDPE grade transitions: should transition time be its own loss category, separate from breakdowns? Is it planned (in the campaign plan) or a loss against plan? What is the typical transition duration per grade pair? | Transitions/changeovers are a distinct "setup/changeover" loss (one of the six big losses), planned in campaign plans; time beyond the standard transition is a loss. | |
| Q10 | PE | After a trip, is the ramp-up back to full rate charged to (a) the original stop (availability), or (b) performance/rate loss? | Six big losses treat startup/ramp-up as its own "startup / reduced yield" loss; most PLA systems attribute it to the stop that caused it. | |
| Q11 | PA / OPS | When two causes overlap on one unit (e.g. compressor trip during a feed shortage), should the time be (a) split equally, (b) given to the first cause (first-out), or (c) given by a priority order in the loss tree? | One primary cause per time slice (first-out or the highest-priority category); the other causes are recorded as contributing, not given time. | |
| Q12 | OPS / PA | "External" losses (no feed, no demand, utilities, downstream blocked, market): should they (a) count against the unit, (b) be excluded from unit OEE but kept in the plan ledger as a separate "external" group? | External / non-controllable losses are a separate class: excluded from unit OEE, reported in the plan ledger so the plan gap still closes. | |
| Q13 | PE | Upstream/downstream: when unit A trips and starves unit B, should B's lost output be charged (a) to A only, with B showing "starved – external", or (b) to both? | Attribute to the originating unit; downstream units record "starved/blocked" as external, so plant totals are not double-counted. | |
| Q14 | MET / PA | Where is "good" measured, and how are **wide-spec / off-grade**, **recycle** and **rework** counted? Is wide-spec sold at a discount (partial loss) or scrapped (full loss)? *(D05 answered "proposed"; the HDPE specifics are still needed.)* | Good = first-pass conforming product at the accounting boundary; rework/recycle is not counted twice; off-grade sold at a discount is valued at the price difference, not as full loss. | |
| Q15 | PA / OPS | Close tolerance: confirm **zero** (every period must close exactly), or allow a small tolerance closed by a labelled line (e.g. ±0.5% of plan or ±N t)? *(D06 = zero; ask again because LA-01 causes many small mismatches.)* | Mass-balance practice allows a small meter/measurement tolerance (typically 0.5–2% of throughput), auto-closed with an explicit labelled line; anything larger must be explained. | |
| Q16 | PE | What rate is the capacity ledger's "maximum": nameplate, demonstrated best (e.g. best sustained 24 h in 90 days), or engineering maximum sustained rate? Who reviews it, and how often? | The capacity ledger uses demonstrated maximum sustainable rate, reviewed periodically (typically yearly or after debottlenecking); nameplate is reference only. | |
| Q17 | PE | Confirm that each HDPE unit runs **one grade at a time** (sequential campaigns), so the concurrent-products flag stays off (D14). | Continuous polymer lines run one grade at a time with transitions between them; concurrent products are modelled only for parallel trains. | |
| Q18 | MET | When the primary actuals source has a gap (PI down, totalizer reset), should we (a) leave the period unresolved, (b) switch to the next source in the D05 order, or (c) interpolate? | Never interpolate silently: use the next authorised source with a quality flag, or leave the period unresolved until data is repaired. | |

### 1.3 Exit criteria for Area 1
- [ ] Q1–Q18 answered and recorded in [DECISIONS.md](DECISIONS.md) (D04 / D05 / D06 / D14 updated or new entries).
- [ ] LA-01 … LA-07 and LA-11 fixed, with fixtures updated (T28 no longer needs a bridge for a plain stop).
- [ ] LA-08 / LA-09 either fixed or scheduled with the SME answer recorded.
- [ ] Backend tests and integration green; maturity re-scored.

---

## Work that does not wait for SME answers (13 Oct 2026)

These findings are correctness, security, performance or cleanup. Each has either a single right answer or a standard default that an owner decision already covers (e.g. "application is v2-only", D06 "no self-approval"). Findings that need an SME policy stay with their area's questions: LA-01, LA-04–06, LA-08–11, DT-01, DT-03, DT-05, DT-06, RC-03, VA-02, VA-03, the failure taxonomy in RCA-07, and the AIAG-VDA choice in RCA-05.

| Batch | Findings | Why no SME is needed | Size |
|---|---|---|---|
| **B1 Correct numbers** | VA-01 (report the approved, reconciled value; drop `schedule_exclusion` from RCA impact), LA-07 (prorate the plan target to the slice window), DT-08 (recompute once after a period settles if an event in it was open), DT-09 (reject future start/end beyond clock skew; micro-stop test on the full occurrence) | Wrong or inconsistent arithmetic today; one correct answer | M |
| **B2 Governance and security** | RCA-02 (v1 RCA writes → 410, app is v2-only), RCA-03 + FE-01 (retire the screen flags; v2 RCA trigger always on), RC-01 (line authors and the revise initiator may not approve, extends D06), RC-02 (reason required on manual and bridge lines; a negative bridge doesn't open budget), DB-03 (retract instead of hard delete; revision FK `RESTRICT`) | Closes bypasses of rules the owner already set | M |
| **B3 RCA rules on the server** | RCA-01 (status transitions + close gate: root cause, actions done with evidence, approver ≠ investigator), RCA-05 (detection per cause; missing score = invalid, not 5), RCA-06 (5-Why minimum depth on the server; fault-tree top-event probability for AND/OR gates), RCA-07 (no repeat trigger while a case is open on the asset) | Standard RCA/CAPA practice; thresholds stay configurable | L |
| **B4 Database performance** | DB-01 (GiST interval index + overlap rewrite), DB-02 / DB-06 (row-comparison keyset on raw columns), DB-04 (RLS InitPlan form), DB-07 (outbox / inbox / audit retention, partition drop job), DB-08 (bulk policy resolve; cap or 202 large scopes), DB-09 / DB-10 / DB-11 (redundant / missing indexes, constraints) | Pure engineering; confirm each with `EXPLAIN ANALYZE` | L |
| **B5 Operator UX** | FE-04 (searchable leaf-only reason picker, shared), FE-05 (retired codes by name), FE-06 (reason code in the close dialog, inline "Code"), FE-07 (select all matching, "to code this shift"), FE-09 (`/v2/assets`), FE-10 (plant-date default), DT-02 label ("Uncoded-class stop time", not "Unknown") | Usability and labelling; no policy change | M |
| **B6 Cleanup** | FE-02 (remove dead v1 Admin constants), FE-03 / LA-14 (delete ~6k lines of unreachable v1 code), FE-11, DB-05 (finish `tenant_id` uuid contract) | Dead code and unfinished migrations | M |
| **B7 Analysis additions** | DT-04 (overlapping-stop warning + review item), DT-07 (in-schedule downtime breakdown, `downtime_external`), FE-08 (Pareto by lost quantity and value) | New engineering metrics; labels are factual | M |

---

## Area 2 — Downtime & reliability KPIs (~60%)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| DT-01 | High | **Asset-level / no-impact stops reduce unit Availability and MTBF exposure** (same root as LA-05). | `domain/accounting/segmentation.ts:35-64`; `v2/production-events/production-events-v2-commands.service.ts:327-345` | ⬜ |
| DT-02 | High | **No state engine (1.10):** unrecorded time counts as run time; "Unknown" in the UI means uncoded-class stop time, not unaccounted time; no event-coverage measure. | `domain/kpi/ideal-time.ts:336-345`; `domain/kpi/downtime-measures.ts:74-76`; FE: `kpi-display.ts:21` | ⬜ |
| DT-03 | High | **Default planned-stop policy mislabelled ISO 22400** (same as LA-11). | `periods/engine-policy-bodies.ts:29` | ⬜ |
| DT-04 | High | **Duplicate/overlapping stops not detected:** manual + PI for the same trip doubles stop count, halves MTBF, splits the Pareto. | `production-event/event-write-model.ts`; `domain/events/event-interval.validation.ts` | ⬜ |
| DT-05 | Medium | **Weak failure basis for MTBF:** every FailureWO counts; unplanned stop counts only with `failure_mode`; WO↔stop de-duplicated on an exact asset only. | `database/migrations/1792793600000-KpiResults.ts:24-44`; `domain/kpi/reliability.ts:40-57` | ⬜ |
| DT-06 | Medium | Overlapping stops split time equally in the Pareto and bad actors; no first-out option; asset bad-actor time is allocated, not the asset's own outage time. | `domain/kpi/downtime-allocation.ts:37-58` | ⬜ |
| DT-07 | Medium | Pareto/downtime totals use the calendar window while Availability uses scheduled time, so they don't reconcile; no `downtime_external` measure. | `domain/kpi/period-kpis.ts:208-216` | ⬜ |
| DT-08 | Medium | A stop still open when the period was computed can stay under-measured after the period ends (partly inferred). | `accounting/accounting-inputs.loader.ts:226-229`; `periods/period-sweep.job.ts:84-95` | ✅ 13 Oct |
| DT-09 | Low | No future-time check on create/patch; merging across a gap turns run time into downtime; micro-stop test uses only the window part of the occurrence. | `v2/.../production-event-v2-write.dto.ts:129,158`; `segmentation.ts:36-47` | 🔄 micro-stop part ✅ 13 Oct; future-time check needs an injectable clock |
| DT-10 | Low | Multi-period A·P·Q ≠ OEE (A over all periods, P/Q/OEE over complete ones); ISO weeks start Monday (Iranian week starts Saturday); standby asset MTBF uses unit run time. | `domain/kpi/aggregate.ts`; `v2/reports/report-sql.ts:28,117` | ⬜ |

## Area 3 — Reconciliation workflow (~80%)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| RC-01 | High | **Separation of duties checks only the submitter.** A manager can author every line, let someone else submit, then approve. | `reconciliation/approval.service.ts:68,99`; `v2/periods/period-roles.ts:8` | ✅ 13 Oct |
| RC-02 | Medium | A negative bridge line frees allocation budget; manual lines need no reason; event evidence doesn't cap quantity. | `domain/reconciliation/allocation-budget.ts:13,51-54`; `reconciliation/line-shape.ts:84`; `v2/reconciliation/reconciliation-v2.dto.ts:144` | 🔄 reason on bridge / unaccounted ✅ 13 Oct; negative-bridge budget waits for Q1 / Q2 |
| RC-03 | Low | Overdue is a report parameter (default 48 h); no close calendar, escalation or month-end sign-off. | `v2/pla-reports/pla-reports-v2.service.ts:134` | ⬜ |
| RC-04 | Low | One evidence event can back lines in several slices or periods with no cap on its quantity. | `reconciliation/line-references.ts` | ⬜ |

## Area 4 — Valuation (~65%)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| VA-01 | High | **Reported value is not the approved value.** Loss-value report and RCA impact read the run's raw candidates, not the approved line set; `schedule_exclusion` counted as loss in RCA impact. | `v2/reports/loss-value-report.ts:69-90`; `rca-case/approved-impact.ts:27,36-46` | 🔄 loss-value report + RCA kinds ✅ 13 Oct; VA-01b open: loss tree and RCA impact still use run candidates |
| VA-02 | High | **No finance role:** valuation policy and FX sign-off is `manager_approver` (D08 names finance). | `v2/valuation/valuation-policies-v2.controller.ts:39`; `v2/profiles/profile-roles.ts:12` | ⬜ |
| VA-03 | Medium | Quality loss valued at margin only (scrap should carry material cost); no sold-out/demand-constrained flag; manual lines have no cost-per-hour view; single FX rate type (no official vs market IRR); no period-average option; late FX approval doesn't trigger a recalculation (partly inferred). | `domain/valuation/reconciled-valuation.ts:111-119`; `domain/valuation/value-line.ts:139-143` | ⬜ |

## Area 5 — RCA / CAPA (~40%)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| RCA-01 | Critical | **No server-side state machine or close gate:** status copied from the body; Draft→Closed in one PATCH with no root cause, actions or verification; closing writes a KB entry and completes the linked events. | `rca-case/rca-case-writer.ts:21`; `rca-case/rca-cases.service.ts:127-132` | ⬜ |
| RCA-02 | Critical | **v1 RCA write routes still live without `@Roles`** (`PUT/DELETE /api/rcas/:id`, v1 analysis tools, recommendations, KB, trigger configs). Tenant isolation holds via RLS; role and unit scope do not. Check whether the global write-access guard covers them. | `rca/rca.controller.ts:60-70`; `app.module.ts:125,158,161` | ✅ 13 Oct (`@Roles` on all v1 RCA writes; routes kept for their callers) |
| RCA-03 | Critical | **RCA trigger policy edited in v2 does nothing:** `v2.rca` defaults off, so the v2 trigger returns `[]` and the hidden v1 auto-create runs. | `rca-case/triggers/rca-trigger.service.ts:67`; `rca/rca-auto-create.service.ts:47`; `feature-flags/feature-flag-keys.ts` | ✅ 13 Oct (inactive notice; flag default stays owner's) |
| RCA-04 | Medium | Action verification counts raw stops (incl. planned) with no run-time normalisation; baseline typed by the claimant; actions `done` without evidence; no effective / not-effective verdict. | `rca-case/rca-recurrence.ts:6`; `domain/rca/rca-verification.ts:314-330`; `rca-case/action-rules.ts:24,89-95` | ⬜ |
| RCA-05 | Medium | FMEA: detection taken from effects, not causes; no AIAG-VDA Action Priority; RPN threshold 100 hard-coded in the browser; missing score silently 5. | `rca-case/rca-analysis-rules.ts:15-35`; FE: `features/rca/model/analysis-settings.ts:10` | ⬜ |
| RCA-06 | Medium | Fault tree: no top-event probability or minimal cut sets. 5-Why depth enforced only in the browser. | `v2/rca/rca-analyses-v2.dto.ts:88-104,150-157` | ⬜ |
| RCA-07 | Medium | Triggers: repeat trigger fires again for each occurrence, no suppression while a case is open; repeats per asset, not per failure mode; free-text `failure_mode` (no ISO 14224); cost trigger not built; no cumulative bad-actor trigger. | `domain/rca/rca-triggers.ts:115`; `rca-case/triggers/rca-trigger.service.ts:115-140` | ⬜ |
| RCA-08 | Low | KB similarity (server-side) ignores failure mode and text; quality score rewards "actions done", not "effective". | `rca-knowledge-base/knowledge-similar.service.ts:31,127-146` | ⬜ |

## Area 6 — Database & performance (~72%)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| DB-01 | High | **Interval-overlap lookups have no lower index bound:** each period recompute reads the unit's whole event history. Fix: GiST `(unit_id, tstzrange(start_time,end_time,'[)'))` (btree_gist installed), or interim covering btree `INCLUDE (end_time, physical_type, physical_state)`. | `accounting/accounting-inputs.loader.ts` `EVENTS_SQL`; `accounting/kpi-inputs.loader.ts`; `periods/actuals-inputs.loader.ts:67-71`; `common/query/overlap-window.ts` | ⬜ |
| DB-02 | High | **Keyset paging sorts on `date_trunc('milliseconds', col)`**, which no index can serve (~30 lists, incl. audit logs). Fix: compare `(col, id) < (:at, :id)` on the raw column. | `v2/common/keyset-page.ts:30-46` | ⬜ |
| DB-03 | High | **v1 event DELETE hard-deletes and cascades away revisions;** loss-line evidence has no FK to the event or revision. Fix: retract instead; `ON DELETE RESTRICT`; add FKs. | `production-event/production-event.service.ts:171`; `EventRevisions` migration `:131` | ✅ 13 Oct |
| DB-04 | Med-High | RLS policy evaluates `current_setting` per row with a `::text` cast; `tenant_id IS NULL` rows visible to every tenant. Fix: `tenant_id = ANY ((SELECT app_rls_tenant_ids())::uuid[])`. | `database/migrations/1793484800000-TenantRowLevelSecurity.ts` | ⬜ |
| DB-05 | Medium | `tenant_id` still `varchar(36)` on core v1 tables, no FK; the `tenant_uuid` contract step was not finished. | Baseline migration; `rca-case/rca-cases.service.ts:35` | ⬜ |
| DB-06 | Medium | Event-list cursor uses the OR form, so the index can't bound it. Fix: row comparison. | `v2/production-events/production-event-v2.query.ts:105` | ⬜ |
| DB-07 | Medium | No retention for outbox, inbox and audit tables (two audit tables); partitions are created but never dropped. | `common/outbox/outbox-relay.service.ts`; `raw-partitions.service.ts` | ⬜ |
| DB-08 | Medium | Scope reports fold up to hundreds of 500-row pages in one request; N+1 `resolveEngine` per run. | `v2/pla-reports/scope-periods.ts`; `v2/period-overview/period-states.ts` | ⬜ |
| DB-09 | Low-Med | Redundant single-column `tenant_id` indexes on rewrite-heavy tables (`loss_lines`, `kpi_results`, …); duplicate sample index. Verify with `pg_stat_user_indexes`. | v2 entity indexes | ⬜ |
| DB-10 | Low | Unindexed FKs on `production_events` (`rca_id`, `plan_id`, `impact_code_id`, `oee_code_id`). | migrations | ⬜ |
| DB-11 | Low | `CHK_production_events_interval` may still be `NOT VALID`; no `segment_end > segment_start` check on `loss_lines`; legacy money in `float`; audit `byDay` in UTC; fillfactor on hot job tables. | migrations | ⬜ |

**Before Area 6 work:** start Docker and run `pg_stat_user_indexes`, plus `EXPLAIN (ANALYZE, BUFFERS)` on `EVENTS_SQL` and the audit list, to confirm DB-01, DB-02 and DB-09.

## Area 7 — Frontend & UX (~74%)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| FE-01 | Critical | **Feature flags no longer match what users see:** all 8 default off, but routes always show v2 and no screen can toggle them. C4 and CLAUDE.md are out of date; only `v2.rca` / `v2.planDashboard` change server behaviour. Decide: retire the screen flags or route on them. | `feature-flags/feature-flag-keys.ts:5-14`; FE: `app/routes/*.tsx`; FE: `features/auth/navigation-items.ts:54-104` | ❎ owner decision 2026-10-12 (v2-only UI, server flags kept); CLAUDE.md / C4 wording is stale |
| FE-02 | High | Admin still edits v1 constants nothing reads ("Loss value per unit" 100, "Default unaccounted %", OEE weights). | FE: `features/admin/dashboard/dashboard-fields.ts:38-40`; `v2/administration/dashboard-config/dashboard-config-defaults.ts:15,19` | ⬜ |
| FE-03 | High | ~6k lines of dead legacy code with fabricated numbers (`PlanDashboard.tsx`, `simulateProductionEvents` `Math.random`, browser KB similarity, `StorageService`). | FE: `components/production-plans/PlanDashboard.tsx`; FE: `services/MasterDataService.ts:1373-1472` | ⬜ |
| FE-04 | High | Reason picker: native select, no search, capped at 500 codes, indentation likely collapsed, parent nodes selectable, duplicated in two places. | FE: `features/event-hub/components/reason-code-select.tsx:35`; FE: `features/plan-dashboard/editor/reason-select.tsx:22` | ⬜ |
| FE-05 | High | Events with retired codes show "Unknown". | FE: `features/event-hub/event-hub-env.tsx:19` | ⬜ |
| FE-06 | Medium | Coding a stop takes 5–6 actions; the close dialog asks for a free-text "Why" but no reason code; no inline "Code" action. | FE: `features/event-hub/.../close-stop-dialog.tsx:41-48`; `current-stops-panel.tsx:75-86` | ⬜ |
| FE-07 | Medium | Shift-end bulk coding: no select-all-matching, no "to code this shift" preset, mandatory "Why". | FE: `event-columns.tsx:33-35`; `use-bulk-code-flow.ts:65` | ⬜ |
| FE-08 | Medium | Downtime Pareto offers duration and count only, no lost quantity or value (needs a server metric). | FE: `features/downtime-analysis/.../downtime-filters.ts:14` | ⬜ |
| FE-09 | Medium | Event/RCA screens use the v1 unpaginated `getAssets()` although `/v2/assets` exists. | FE: `features/event-hub/hooks/use-asset-options.ts:3` and 3 others | ⬜ |
| FE-10 | Medium | RCA change tool defaults dates in UTC, not plant time. | FE: `features/rca/case/analysis/tools/change/change-tool.tsx:36` | ⬜ |
| FE-11 | Low | Stale docstring (20 vs 100 per page); 58 lines > 220 chars; unused `PlanDashboardOff`. | FE: `event-filters.ts:44`; `plan-dashboard-off.tsx` | ⬜ |
