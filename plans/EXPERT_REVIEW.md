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
| 1 | Loss accounting engine | ~65% → ~90% (13 Oct, after SME fixes) | Decimal maths, signed residuals and immutable runs are strong. But the plan ledger is priced at the wrong rate, so ordinary shifts need a manual bridge line to close. | 🔄 SME answered 13 Oct; fixes in progress |
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
| Q1 | PA | When a plan target is below planning capacity, which rate converts lost time into lost tonnes **in the plan ledger**: (a) the plan's own implied rate (target ÷ eligible time), (b) the profile planning rate plus an explicit "plan slack" line, or (c) the sustained maximum rate? | The plan ledger values time losses at the plan's own implied rate, so plan − actual closes without a balancing entry; the gap to capacity is shown only in the capacity ledger. |  **SME 13 Oct:** plan ledger uses the approved, time-specific planned rate (planned t ÷ eligible planned h, per interval/grade); capacity ledger uses the approved capacity rate. Two views of one event — never added. Correct rate does not guarantee closure (measurement, quality, recovery). |
| Q2 | PA | If a unit runs **above** plan rate after a stop and catches up, should the gain (a) net off the stop's loss, or (b) be shown as a separate "rate gain" line with the stop's loss kept gross? | Report losses gross and gains as a separate line (never net), so every cause stays visible and Σ losses − Σ gains = gap. |  **SME:** keep gross losses, show recovery gains separately, net variance in the summary. Store losses and gains separately, count a recovery once against the same baseline, keep the original downtime for reliability. |
| Q3 | MET / PA | When a declared off-spec or derate quantity is larger than the measurements can support (e.g. lab says 30 t off-spec, but gross − good is 20 t), should the system (a) block the period calculation, or (b) calculate and flag the claim for reconciliation? | Never block the calculation on one bad input; flag the exception and resolve it in the reconciliation step (data validation and reconciliation practice). |  **SME:** save the disputed entry and flag it, continue the valid calculations, but **block final approval** of materially inconsistent results until corrected or covered by an authorised adjustment. "Never block" was too broad. Compare like-for-like (gross event losses may exceed net shortfall when there are gains). |
| Q4 | PA / PE | Loss that no recorded event explains (capacity − actual with no cause): show it as (a) "performance / slow running", or (b) "unexplained / unaccounted"? Do we have a measured rate tag per unit to prove real slow running? | Speed loss is claimed only against rate evidence; the rest is reported as unexplained/unaccounted until someone explains it. |  **SME:** reduced speed only where measurements support it (rate tag, or reliable cumulative output + operating time); the rest stays explicitly unexplained/unaccounted. |
| Q5 | PE / OPS | Which stops reduce **unit** output: (a) only full-unit stops, (b) equipment stops unless a standby takes over, (c) partial stops as a fraction (e.g. one of two trains = 50%)? Which equipment in unit100–unit500 has installed spares? | ISO 14224 classifies each failure's impact on production as total / partial / none; only total counts as unit downtime, partial as a rate fraction, none as zero loss. |  **SME:** record equipment condition separately from production impact: standby holds output → failure, no loss; throughput drops → partial loss; unit stops → full downtime. Keep actual stopped hours and **equivalent downtime** (lost qty ÷ reference rate) as separate fields. |
| Q6 | OPS / PA | A planned stop (PM, cleaning, catalyst change) that the plan already allowed for: should it (a) reduce availability, or (b) be removed from scheduled time and not count as a loss? *(D04 item 2 asked this, but the option labelled "ISO 22400 default" was the wrong one, so the "as per standard" answer needs confirming.)* | ISO 22400: planned downtime is subtracted from the base (PBT = POT − planned downtime); it is not an availability loss. Unplanned overrun of a planned stop is a loss. |  **SME:** depends on the schedule definition. Time genuinely outside the production schedule is excluded; stops inside planned production time (incl. planned changeovers) **do** reduce availability. "Planned downtime is excluded" was too broad. |
| Q7 | PA | When a rate (e.g. maximum sustained rate) or a shift calendar is approved **back-dated**, should (a) open periods recompute automatically and approved periods get a change proposal, or (b) changes apply only from today? | Master data is effective-dated; open periods recompute automatically; closed/approved periods change only through a controlled, approved restatement. |  **SME:** versioned, effective-dated rules; open periods recalculate, closed periods keep approved results, a restatement is a new approved version keeping the original, reason and approver. Store effective time and entered/approved time. |
| Q8 | PE / MET | A production-output record that spans two shifts: split by (a) elapsed time, (b) running time excluding stops, (c) book all at its end time, or (d) use the PI totalizer per shift? Which units have reliable totalizers? | Use measured totalizer deltas per period where available; otherwise pro-rate by running time, never by plain clock time. |  **SME:** prefer cumulative meter readings at the boundary, then integration of reliable rate measurements, then running-time proration (estimate) only when the rate was roughly constant. Allocations sum to the original; record the method; handle resets, time zones, missing readings. |
| Q9 | PE | HDPE grade transitions: should transition time be its own loss category, separate from breakdowns? Is it planned (in the campaign plan) or a loss against plan? What is the typical transition duration per grade pair? | Transitions/changeovers are a distinct "setup/changeover" loss (one of the six big losses), planned in campaign plans; time beyond the standard transition is a loss. |  **SME:** grade transitions are their own events with stopped-time, rate and quality effects; allowance from a plant transition matrix (from→to grade, reactor/train, catalyst, conditions); only the excess over an approved allowance is an unfavourable variance; off-grade while running is quality loss, not downtime. **Plant values needed.** |
| Q10 | PE | After a trip, is the ramp-up back to full rate charged to (a) the original stop (availability), or (b) performance/rate loss? | Six big losses treat startup/ramp-up as its own "startup / reduced yield" loss; most PLA systems attribute it to the stop that caused it. |  **SME:** record both the physical loss type (stopped / reduced rate / off-spec) and the causal link to the triggering trip; never turn the whole ramp-up into stopped time. |
| Q11 | PA / OPS | When two causes overlap on one unit (e.g. compressor trip during a feed shortage), should the time be (a) split equally, (b) given to the first cause (first-out), or (c) given by a priority order in the loss tree? | One primary cause per time slice (first-out or the highest-priority category); the other causes are recorded as contributing, not given time. |  **SME:** allocate each lost quantity once; a documented, reviewable causal rule picks the primary cause per interval; keep contributing causes. No universal rule (equal split or first-out). |
| Q12 | OPS / PA | "External" losses (no feed, no demand, utilities, downstream blocked, market): should they (a) count against the unit, (b) be excluded from unit OEE but kept in the plan ledger as a separate "external" group? | External / non-controllable losses are a separate class: excluded from unit OEE, reported in the plan ledger so the plan gap still closes. |  **SME:** external losses (steam, feed, blocking) inside the schedule **do** reduce availability; classify them as external. Only time genuinely excluded from the approved schedule (e.g. no demand) is excluded. Optional separate controllable measure with stated exclusions. |
| Q13 | PE | Upstream/downstream: when unit A trips and starves unit B, should B's lost output be charged (a) to A only, with B showing "starved – external", or (b) to both? | Attribute to the originating unit; downstream units record "starved/blocked" as external, so plant totals are not double-counted. |  **SME:** keep origin (initiating unit), impact (each affected unit's own variance) and consolidated consequence (site boundary). Don't erase B's real loss; prevent duplication only at consolidation; buffers and yields matter. |
| Q14 | MET / PA | Where is "good" measured, and how are **wide-spec / off-grade**, **recycle** and **rework** counted? Is wide-spec sold at a discount (partial loss) or scrapped (full loss)? *(D05 answered "proposed"; the HDPE specifics are still needed.)* | Good = first-pass conforming product at the accounting boundary; rework/recycle is not counted twice; off-grade sold at a discount is valued at the price difference, not as full loss. |  **SME:** OEE quality = first-pass conforming; rework doesn't undo the quality loss; distinguish first-pass good, off-grade, scrap, recovered; price downgrade is a separate economic figure; ordered wide-spec grade can be good; recycled tonnes counted once. |
| Q15 | PA / OPS | Close tolerance: confirm **zero** (every period must close exactly), or allow a small tolerance closed by a labelled line (e.g. ±0.5% of plan or ±N t)? *(D06 = zero; ask again because LA-01 causes many small mismatches.)* | Mass-balance practice allows a small meter/measurement tolerance (typically 0.5–2% of throughput), auto-closed with an explicit labelled line; anything larger must be explained. |  **SME:** tolerance configurable, default zero is acceptable (GE PLA); no universal 0.5–2 %; any tolerance needs a stated denominator, absolute threshold, approval conditions and residual category, justified from measurement uncertainty. **Plant values needed.** |
| Q16 | PE | What rate is the capacity ledger's "maximum": nameplate, demonstrated best (e.g. best sustained 24 h in 90 days), or engineering maximum sustained rate? Who reviews it, and how often? | The capacity ledger uses demonstrated maximum sustainable rate, reviewed periodically (typically yearly or after debottlenecking); nameplate is reference only. |  **SME:** capacity ledger = approved sustainable capability by grade and configuration (engineering + operating evidence); keep nameplate, demonstrated and planned rates separately; a momentary peak is not capacity; OEE ideal rate is a separate purpose. |
| Q17 | PE | Confirm that each HDPE unit runs **one grade at a time** (sequential campaigns), so the concurrent-products flag stays off (D14). | Continuous polymer lines run one grade at a time with transitions between them; concurrent products are modelled only for parallel trains. |  **SME:** one target grade per reactor/train can be right, but the unit may handle several grades at once (silos, packaging, residence time). Track grade by resource, stream, lot and effective time; count each quantity once at the reporting boundary. |
| Q18 | MET | When the primary actuals source has a gap (PI down, totalizer reset), should we (a) leave the period unresolved, (b) switch to the next source in the D05 order, or (c) interpolate? | Never interpolate silently: use the next authorised source with a quality flag, or leave the period unresolved until data is repaired. |  **SME:** approved source hierarchy, data-quality status kept, every substitution/estimate visible with source, method, approver; never turn missing data into zero; no defensible source → result provisional / period open. |

### 1.4 What the SME answers change (13 Oct 2026)

Where the SME corrected the one-line "standard" in 1.2, the SME answer wins. The corrections: Q3 (approval must be blocked, not "never block"), Q6 and Q12 (planned and external stops inside the schedule **do** reduce availability), Q15 (no universal 0.5–2 % tolerance), Q17 (multiple grades can coexist in a unit).

| Finding | SME basis | Action | Needs plant data? | Status |
|---|---|---|---|---|
| LA-01 | Q1, Q2 | Plan ledger prices time losses at the planned rate of each plan interval (target ÷ eligible planned time); recovery above the planned rate becomes a separate gain line; losses stay gross, net shown in totals | No | ✅ `8391949` (engine 2.5.3) |
| LA-02b (new) | Q3 | Submission/approval blocked while a slice is flagged `claim_exceeds_component`, until the over-claiming candidate is rejected or adjusted, or an authorised adjustment covers it. The run keeps calculating (LA-02 stays). | No | ✅ `2905bd6` |
| LA-04 | Q4 | Cause-less capacity remainder labelled `unexplained` (not slow running) unless a rate measurement supports it | No | ✅ `8391949` (plan: stays unaccounted; capacity: flagged `unexplained`) |
| LA-05 / DT-01 | Q5 | Only full-stop impact counts as stopped time; `fractional` impact becomes a rate loss with **equivalent downtime** reported separately; `none` = equipment event without production loss | No | ✅ `8171b43` + Event Hub impact selector `629505c` |
| LA-06 | Q8 | Output records spanning periods: counter / totalizer first, then rate integration, then running-time proration (excluding stops) instead of elapsed time; allocation method recorded | No | ✅ `519207b` (actuals 2.4.1) + method shown in UI |
| LA-09 / DT-06 | Q11 | Overlapping causes: keep "allocate once"; make the allocation rule an explicit, reviewable policy (equal share today; add primary-cause option) | Plant chooses the rule | ✅ `cf2c34a` (`overlapAllocation`: equal_share / first_out) |
| LA-11 / DT-03 | Q6 | **Default kept** (stops inside the schedule reduce availability); only correct the "ISO 22400" label and document the schedule definition | No | ✅ `cf2c34a` |
| DT (Q12) | Q12 | **No change**: external stops already reduce availability; add an external category breakdown (DT-07) | No | ✅ behaviour confirmed; breakdown with DT-07 (Area 2) |
| LA-08 | Q9, Q10 | Grade-transition events with allowance matrix; ramp-up recorded as rate / quality loss linked to the trip | **Yes**: transition matrix per grade pair | ⬜ data |
| Q13 | Q13 | Origin / impact / consolidated consequence model across units | Plant flow + buffers | ⬜ later |
| Q14 | Q14 | First-pass good vs off-grade / scrap / recovered; price downgrade as separate valuation | Boundaries, prices | ⬜ later |
| Q15 | Q15 | Tolerance stays configurable, default zero (current) | **Yes**: justified tolerances | ✅ matches |
| Q16 | Q16 | Capacity ledger keeps the approved sustained rate per grade/config (current `sustained` kind) | **Yes**: rates per grade | ✅ matches |
| Q17 | Q17 | Keep sequential per reactor (D14); later: grade by resource / stream / lot | Resource model | ⬜ later |
| Q18 | Q18 | Matches D05 authority + null-not-zero; add method / approver display on estimates | No | ✅ method shown; adjustments carry approver (D05/2.4) |
| LA-03 | Q7 | Matches what was built (open periods recompute, approved get a change proposal); restatement keeps original + reason + approver | No | ✅ |

**Plant values still needed** (SME): grade-specific planned and sustained rates, production calendars, grade transition allowances, measurement boundaries, source hierarchy per unit, justified reconciliation tolerances.

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

## Area 2 — Downtime & reliability KPIs (~80%: everything SME-independent done 13 Oct; the rest waits for D1–D17)

### 2.0 Work that does not wait for the SME (part B, started 13 Oct 2026)

SME questions D1–D17 were sent on 13 Oct 2026; the phases below need none of the answers (labels are factual, thresholds stay policy settings without a guessed default).

| Phase | Findings | Scope | Status |
|---|---|---|---|
| P1 | DT-09 | Manual start/end not in the future (422 `IN_FUTURE`), injectable server clock | ✅ |
| P2 | DT-02 (label part) | "Unknown" in downtime screens renamed to what it is (stop time of an uncoded class); event coverage measure waits for D1/D2 | ✅ (already in `8171b43`: "Stops not classed planned/unplanned" + incomplete-split notice) |
| P3 | DT-04 | Overlapping stops of one asset found on read: `possibleDuplicate` list/export filter, Event Hub "Possible duplicate stops only"; the user merges or retracts. Merge window and automatic de-duplication wait for D5 | ✅ |
| P4 | DT-07 | New KPIs `downtime_in_schedule` (reconciles with scheduled availability) and `downtime_external`; the calendar total is labelled as calendar. Moving the Pareto to scheduled time waits for D14 | ✅ |
| P5 | FE-08 | Downtime Analysis "Lost production by stop reason": availability losses per reason as quantity or margin, from `loss-tree` with the new `kinds` filter (approved lines, else the shown run) | ✅ |
| P6 | FE-06, FE-07 | Reason code in the close dialog ("Code and close"); inline "Code" on uncoded rows and current stops; "To code" quick filter; "select all listed". Selecting every match on the server (bulk by filter) and dropping the mandatory bulk "Why" are not done (API / owner decision) | ✅ |
| P7 | DT-10 (maths part) | A, P, Q summed over the periods their OEE counts (A × P × Q = OEE across periods); plant `week_start` (Saturday for Iranian plants — owner answer to D16, 13 Oct; Monday ISO otherwise), Saturday weeks keyed by their Saturday | ✅ |
| P8 | FE-09 | Asset names, Event Hub asset filter, RCA asset options and mapping targets on `GET /v2/assets` (every keyset page of 500, one shared cache); the v1 asset directory helper removed. The plant selector still browses other plants through v1 (see the v2-only plan) | ✅ |

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| DT-01 | High | **Asset-level / no-impact stops reduce unit Availability and MTBF exposure** (same root as LA-05). | `domain/accounting/segmentation.ts:35-64`; `v2/production-events/production-events-v2-commands.service.ts:327-345` | ✅ 13 Oct (SME Q5: impact `full_stop` / `fractional` / `none`; only stopping downtime is stopped time, `8171b43`) |
| DT-02 | High | **No state engine (1.10):** unrecorded time counts as run time; "Unknown" in the UI means uncoded-class stop time, not unaccounted time; no event-coverage measure. | `domain/kpi/ideal-time.ts:336-345`; `domain/kpi/downtime-measures.ts:74-76`; FE: `kpi-display.ts:21` | ⬜ |
| DT-03 | High | **Default planned-stop policy mislabelled ISO 22400** (same as LA-11). | `periods/engine-policy-bodies.ts:29` | ✅ 13 Oct (SME Q6: label corrected with LA-11, `cf2c34a`) |
| DT-04 | High | **Duplicate/overlapping stops not detected:** manual + PI for the same trip doubles stop count, halves MTBF, splits the Pareto. | `production-event/event-write-model.ts`; `domain/events/event-interval.validation.ts` | 🔄 13 Oct: listed via `possibleDuplicate`; automatic handling waits for D5 |
| DT-05 | Medium | **Weak failure basis for MTBF:** every FailureWO counts; unplanned stop counts only with `failure_mode`; WO↔stop de-duplicated on an exact asset only. | `database/migrations/1792793600000-KpiResults.ts:24-44`; `domain/kpi/reliability.ts:40-57` | ⬜ waits for SME D8 (failure definition), D9 (exposure), D10 (repair evidence), D11 (ISO 14224 taxonomy) |
| DT-06 | Medium | Overlapping stops split time equally in the Pareto and bad actors; no first-out option; asset bad-actor time is allocated, not the asset's own outage time. | `domain/kpi/downtime-allocation.ts:37-58` | 🔄 13 Oct: first-out available as policy `overlapAllocation` (`cf2c34a`); default waits for SME D7 |
| DT-07 | Medium | Pareto/downtime totals use the calendar window while Availability uses scheduled time, so they don't reconcile; no `downtime_external` measure. | `domain/kpi/period-kpis.ts:208-216` | 🔄 13 Oct: `downtime_in_schedule` + `downtime_external` (KPI 2.7.1); Pareto basis waits for D14 |
| DT-08 | Medium | A stop still open when the period was computed can stay under-measured after the period ends (partly inferred). | `accounting/accounting-inputs.loader.ts:226-229`; `periods/period-sweep.job.ts:84-95` | ✅ 13 Oct |
| DT-09 | Low | No future-time check on create/patch; merging across a gap turns run time into downtime; micro-stop test uses only the window part of the occurrence. | `v2/.../production-event-v2-write.dto.ts:129,158`; `segmentation.ts:36-47` | ✅ 13 Oct (micro-stop on the full occurrence; 422 `IN_FUTURE` beyond now + 120 s via the injectable `Clock`); merge-gap rule waits for D5 |
| DT-10 | Low | Multi-period A·P·Q ≠ OEE (A over all periods, P/Q/OEE over complete ones); ISO weeks start Monday (Iranian week starts Saturday); standby asset MTBF uses unit run time. | `domain/kpi/aggregate.ts`; `v2/reports/report-sql.ts:28,117` | 🔄 13 Oct: A·P·Q = OEE ✅, week start per plant ✅; standby MTBF exposure waits for D9 |

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
| VA-01 | High | **Reported value is not the approved value.** Loss-value report and RCA impact read the run's raw candidates, not the approved line set; `schedule_exclusion` counted as loss in RCA impact. | `v2/reports/loss-value-report.ts:69-90`; `rca-case/approved-impact.ts:27,36-46` | ✅ loss-value report + RCA kinds 13 Oct; VA-01b ✅ `b838da9` (approved ledger lines feed loss tree and RCA impact) |
| VA-02 | High | **No finance role:** valuation policy and FX sign-off is `manager_approver` (D08 names finance). | `v2/valuation/valuation-policies-v2.controller.ts:39`; `v2/profiles/profile-roles.ts:12` | ⬜ |
| VA-03 | Medium | Quality loss valued at margin only (scrap should carry material cost); no sold-out/demand-constrained flag; manual lines have no cost-per-hour view; single FX rate type (no official vs market IRR); no period-average option; late FX approval doesn't trigger a recalculation (partly inferred). | `domain/valuation/reconciled-valuation.ts:111-119`; `domain/valuation/value-line.ts:139-143` | ⬜ |

## Area 5 — RCA / CAPA (~40%)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| RCA-01 | Critical | **No server-side state machine or close gate:** status copied from the body; Draft→Closed in one PATCH with no root cause, actions or verification; closing writes a KB entry and completes the linked events. | `rca-case/rca-case-writer.ts:21`; `rca-case/rca-cases.service.ts:127-132` | 🔄 close gate ✅ 13 Oct (root cause + actions finished); second approver / verification → SME |
| RCA-02 | Critical | **v1 RCA write routes still live without `@Roles`** (`PUT/DELETE /api/rcas/:id`, v1 analysis tools, recommendations, KB, trigger configs). Tenant isolation holds via RLS; role and unit scope do not. Check whether the global write-access guard covers them. | `rca/rca.controller.ts:60-70`; `app.module.ts:125,158,161` | ✅ 13 Oct (`@Roles` on all v1 RCA writes; routes kept for their callers) |
| RCA-03 | Critical | **RCA trigger policy edited in v2 does nothing:** `v2.rca` defaults off, so the v2 trigger returns `[]` and the hidden v1 auto-create runs. | `rca-case/triggers/rca-trigger.service.ts:67`; `rca/rca-auto-create.service.ts:47`; `feature-flags/feature-flag-keys.ts` | ✅ 13 Oct (inactive notice; flag default stays owner's) |
| RCA-04 | Medium | Action verification counts raw stops (incl. planned) with no run-time normalisation; baseline typed by the claimant; actions `done` without evidence; no effective / not-effective verdict. | `rca-case/rca-recurrence.ts:6`; `domain/rca/rca-verification.ts:314-330`; `rca-case/action-rules.ts:24,89-95` | ⬜ |
| RCA-05 | Medium | FMEA: detection taken from effects, not causes; no AIAG-VDA Action Priority; RPN threshold 100 hard-coded in the browser; missing score silently 5. | `rca-case/rca-analysis-rules.ts:15-35`; FE: `features/rca/model/analysis-settings.ts:10` | ⬜ moved to SME: detection per cause + no default 5 changes the FMEA contract; decide with the AIAG-VDA question |
| RCA-06 | Medium | Fault tree: no top-event probability or minimal cut sets. 5-Why depth enforced only in the browser. | `v2/rca/rca-analyses-v2.dto.ts:88-104,150-157` | 🔄 fault-tree probability ✅ 13 Oct; 5-Why depth on the server → SME (guideline vs rule) |
| RCA-07 | Medium | Triggers: repeat trigger fires again for each occurrence, no suppression while a case is open; repeats per asset, not per failure mode; free-text `failure_mode` (no ISO 14224); cost trigger not built; no cumulative bad-actor trigger. | `domain/rca/rca-triggers.ts:115`; `rca-case/triggers/rca-trigger.service.ts:115-140` | 🔄 suppression while a case is open ✅ 13 Oct; taxonomy / cost / bad-actor triggers → SME |
| RCA-08 | Low | KB similarity (server-side) ignores failure mode and text; quality score rewards "actions done", not "effective". | `rca-knowledge-base/knowledge-similar.service.ts:31,127-146` | ⬜ |

## Area 6 — Database & performance (~72%)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| DB-01 | High | **Interval-overlap lookups have no lower index bound:** each period recompute reads the unit's whole event history. Fix: GiST `(unit_id, tstzrange(start_time,end_time,'[)'))` (btree_gist installed), or interim covering btree `INCLUDE (end_time, physical_type, physical_state)`. | `accounting/accounting-inputs.loader.ts` `EVENTS_SQL`; `accounting/kpi-inputs.loader.ts`; `periods/actuals-inputs.loader.ts:67-71`; `common/query/overlap-window.ts` | ✅ 13 Oct (GiST span index; loaders use range overlap; list filter `overlap-window` unchanged) |
| DB-02 | High | **Keyset paging sorts on `date_trunc('milliseconds', col)`**, which no index can serve (~30 lists, incl. audit logs). Fix: compare `(col, id) < (:at, :id)` on the raw column. | `v2/common/keyset-page.ts:30-46` | ✅ 13 Oct |
| DB-03 | High | **v1 event DELETE hard-deletes and cascades away revisions;** loss-line evidence has no FK to the event or revision. Fix: retract instead; `ON DELETE RESTRICT`; add FKs. | `production-event/production-event.service.ts:171`; `EventRevisions` migration `:131` | ✅ 13 Oct |
| DB-04 | Med-High | RLS policy evaluates `current_setting` per row with a `::text` cast; `tenant_id IS NULL` rows visible to every tenant. Fix: `tenant_id = ANY ((SELECT app_rls_tenant_ids())::uuid[])`. | `database/migrations/1793484800000-TenantRowLevelSecurity.ts` | ✅ 13 Oct (InitPlan form; `tenant_id IS NULL` branch kept — owner) |
| DB-05 | Medium | `tenant_id` still `varchar(36)` on core v1 tables, no FK; the `tenant_uuid` contract step was not finished. | Baseline migration; `rca-case/rca-cases.service.ts:35` | ⬜ |
| DB-06 | Medium | Event-list cursor uses the OR form, so the index can't bound it. Fix: row comparison. | `v2/production-events/production-event-v2.query.ts:105` | ✅ 13 Oct |
| DB-07 | Medium | No retention for outbox, inbox and audit tables (two audit tables); partitions are created but never dropped. | `common/outbox/outbox-relay.service.ts`; `raw-partitions.service.ts` | 🔄 outbox / inbox retention + pending index ✅ 13 Oct; audit-log and partition retention → owner (data retention) |
| DB-08 | Medium | Scope reports fold up to hundreds of 500-row pages in one request; N+1 `resolveEngine` per run. | `v2/pla-reports/scope-periods.ts`; `v2/period-overview/period-states.ts` | ⬜ low impact: the N+1 only hits runs without a recorded tolerance policy (pre-2.5) |
| DB-09 | Low-Med | Redundant single-column `tenant_id` indexes on rewrite-heavy tables (`loss_lines`, `kpi_results`, …); duplicate sample index. Verify with `pg_stat_user_indexes`. | v2 entity indexes | ⬜ |
| DB-10 | Low | Unindexed FKs on `production_events` (`rca_id`, `plan_id`, `impact_code_id`, `oee_code_id`). | migrations | ✅ 13 Oct |
| DB-11 | Low | `CHK_production_events_interval` may still be `NOT VALID`; no `segment_end > segment_start` check on `loss_lines`; legacy money in `float`; audit `byDay` in UTC; fillfactor on hot job tables. | migrations | ⬜ |

**Before Area 6 work:** start Docker and run `pg_stat_user_indexes`, plus `EXPLAIN (ANALYZE, BUFFERS)` on `EVENTS_SQL` and the audit list, to confirm DB-01, DB-02 and DB-09.

## Area 7 — Frontend & UX (~74%)

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| FE-01 | Critical | **Feature flags no longer match what users see:** all 8 default off, but routes always show v2 and no screen can toggle them. C4 and CLAUDE.md are out of date; only `v2.rca` / `v2.planDashboard` change server behaviour. Decide: retire the screen flags or route on them. | `feature-flags/feature-flag-keys.ts:5-14`; FE: `app/routes/*.tsx`; FE: `features/auth/navigation-items.ts:54-104` | ❎ owner decision 2026-10-12 (v2-only UI, server flags kept); CLAUDE.md / C4 wording is stale |
| FE-02 | High | Admin still edits v1 constants nothing reads ("Loss value per unit" 100, "Default unaccounted %", OEE weights). | FE: `features/admin/dashboard/dashboard-fields.ts:38-40`; `v2/administration/dashboard-config/dashboard-config-defaults.ts:15,19` | ⬜ |
| FE-03 | High | ~6k lines of dead legacy code with fabricated numbers (`PlanDashboard.tsx`, `simulateProductionEvents` `Math.random`, browser KB similarity, `StorageService`). | FE: `components/production-plans/PlanDashboard.tsx`; FE: `services/MasterDataService.ts:1373-1472` | ✅ 13 Oct: v2-only plan V1–V6 — 82 unreachable v1 files (~36k lines) removed, every screen on v2 (only `/api/auth/*` stays unversioned) |
| FE-04 | High | Reason picker: native select, no search, capped at 500 codes, indentation likely collapsed, parent nodes selectable, duplicated in two places. | FE: `features/event-hub/components/reason-code-select.tsx:35`; FE: `features/plan-dashboard/editor/reason-select.tsx:22` | ⬜ |
| FE-05 | High | Events with retired codes show "Unknown". | FE: `features/event-hub/event-hub-env.tsx:19` | ⬜ |
| FE-06 | Medium | Coding a stop takes 5–6 actions; the close dialog asks for a free-text "Why" but no reason code; no inline "Code" action. | FE: `features/event-hub/.../close-stop-dialog.tsx:41-48`; `current-stops-panel.tsx:75-86` | ✅ 13 Oct: Code = 3 actions (Code → pick → Save); close dialog codes too |
| FE-07 | Medium | Shift-end bulk coding: no select-all-matching, no "to code this shift" preset, mandatory "Why". | FE: `event-columns.tsx:33-35`; `use-bulk-code-flow.ts:65` | 🔄 13 Oct: "To code" filter + "select all listed"; bulk-by-filter (API) and optional "Why" (owner, with D13) open |
| FE-08 | Medium | Downtime Pareto offers duration and count only, no lost quantity or value (needs a server metric). | FE: `features/downtime-analysis/.../downtime-filters.ts:14` | ✅ 13 Oct: lost-production card (loss tree, `kinds=availability`) |
| FE-09 | Medium | Event/RCA screens use the v1 unpaginated `getAssets()` although `/v2/assets` exists. | FE: `features/event-hub/hooks/use-asset-options.ts:3` and 3 others | ✅ 13 Oct: `useAssetDirectory` (v2) |
| FE-10 | Medium | RCA change tool defaults dates in UTC, not plant time. | FE: `features/rca/case/analysis/tools/change/change-tool.tsx:36` | ⬜ |
| FE-11 | Low | Stale docstring (20 vs 100 per page); 58 lines > 220 chars; unused `PlanDashboardOff`. | FE: `event-filters.ts:44`; `plan-dashboard-off.tsx` | ⬜ |
