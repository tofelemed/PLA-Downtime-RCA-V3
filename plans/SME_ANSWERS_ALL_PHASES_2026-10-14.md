# Plant SME answers: benchmarks and worked examples

Prepared 14 October 2026. Source questionnaire: Questions for the plant SME.pdf (13 October 2026).

All 53 items answered. D16 was stated as already configured. Examples and proposed pilot settings are illustrative, not actual plant data or universal standards. Public references support the stated principles; software implementation claims in the questionnaire were not independently verified.

## Part A: Downtime and reliability

### D1. Machine states and time buckets

**Meaning:** Decide how the system describes each unit at every instant, including whether it was scheduled, physically producing, waiting, or unobserved.

**Recommended answer:** Track running, internal stop, planned maintenance/changeover, starved, blocked, standby, and not scheduled/no order. Keep unknown as a data-quality condition that prevents an unsupported running/stopped classification. Maintain three separate attributes: physical state, schedule status, and cause. Use one mutually exclusive primary time bucket, while retaining secondary attributes. Map PackML signals where available; reactors need process-specific mappings, while bagging machines often map more directly.

**Worked example:** An extruder loses reactor feed for 30 minutes while scheduled to run: physical state = stopped; reason = starved; origin = reactor. Its availability loses 30 minutes. A standby pump is ready but not running; it must not inherit the extruder state or be labelled broken.

**Benchmark basis:** Reference: PackML distinguishes external-condition suspension from internal holding [S1](https://reference.opcfoundation.org/specs/OPC-30050/6). The exact business buckets above are a recommended plant configuration, not a verbatim ISA-95/PackML state list.

**Plant confirmation:** OPS and automation: approve a state mapping for each reactor, extruder, bagger, utility system and standby asset.

### D2. Missing signals and unknown time

**Meaning:** Decide when missing telemetry becomes an information gap and how the gap affects reported KPIs.

**Recommended answer:** For periodic heartbeat data, pilot a stale alarm at 3 expected intervals plus known communication jitter. An explicit bad-quality status marks the signal unreliable immediately. Do not use unchanged values or a quiet exception-compressed historian as proof of lost communication. Do not silently fill a gap. Preserve the scheduled denominator, publish known-data coverage, and show provisional availability or bounds; do not publish a flattering certified KPI by simply deleting unknown time. MTBF must use verified exposure and disclose incomplete failure detection.

**Worked example:** For a 10-second heartbeat, a proposed 30-second stale alarm detects a gap. In an 8-hour schedule with 6 hours known running, 1 known stopped and 1 unknown, availability lies between 75% and 87.5%; data coverage is 87.5%. The known-time ratio of 6/7 = 85.7% can be shown only as conditional on observed time.

**Benchmark basis:** OPC UA carries values, status and timestamps and supports exception-based sources [S2](https://reference.opcfoundation.org/specs/OPC-10000-4/7.11). The 3-interval rule and reporting controls are proposed policies, not global standards.

**Plant confirmation:** MET/automation: source heartbeat semantics, expected latency, permitted estimation and the coverage required for official reporting.

### D3. Upstream starvation and downstream blocking

**Meaning:** Separate the unit that stopped from the unit that caused the stop.

**Recommended answer:** Include starvation/blocking within scheduled production in the affected unit's operational availability. Code the cause as external to that unit, and link the originating asset. Keep equipment-internal reliability separate. At site level, consolidate through the material-flow boundary so the same final-product consequence is counted once.

**Worked example:** A reactor trip starves an extruder for 2 hours of a 24-hour production schedule. With no other stops, extruder availability is 22/24 = 91.7%. Its loss cause is the reactor. If 40 tonnes of final product are lost across this chain, do not add 40 tonnes at each stage and report 80 tonnes.

**Benchmark basis:** Published OEE guidance includes upstream/downstream losses at the line constraint [S3](https://www.oee.com/faq/). The linked-event and consolidation design is recommended implementation.

**Plant confirmation:** OPS/PA: define the unit and site boundaries, conversion yields and intervening buffers.

### D4. Planned maintenance overruns

**Meaning:** Decide whether time beyond the agreed maintenance window remains planned or becomes an unfavorable extension.

**Recommended answer:** Freeze the approved maintenance window before the event. Classify the excess as unplanned extension of planned maintenance, linked to the original job. Do not automatically call it an equipment breakdown or count it as a new MTBF failure. Its effect on availability follows the frozen production calendar: time that should have returned to production reduces availability.

**Worked example:** A shutdown approved for 08:00-16:00 finishes at 19:00. Record 8 hours planned maintenance and 3 hours overrun. If those 3 hours were scheduled at 20 tonnes/hour, the plan shortfall is 60 tonnes. A late permit caused the overrun, so there is no new equipment failure count.

**Benchmark basis:** Planned and unplanned stops within scheduled production can be OEE losses [S4](https://www.oee.com/oee-six-big-losses/). A separate maintenance-overrun category is a proposed accounting rule.

**Plant confirmation:** OPS/MNT: freeze-point, allowed scope changes and overrun reason codes.

### D5. Repeat stops and the merge window

**Meaning:** Decide whether rapid stop-restart-stop sequences belong to one unresolved incident or represent distinct failures.

**Recommended answer:** Keep every raw transition. As a pilot, flag same-asset/same-mode repeats within 2 minutes for grouping under one incident; validate against real event traces before automatic grouping. Merge a reliability failure only when function was not successfully restored, not merely because timestamps are close. Distinct verified repairs followed by new failures remain separate. Deduplicate duplicate manual/historian records independently of repeat grouping.

**Worked example:** A conveyor is stopped 10:00-10:03, runs 10:03-10:05, then stops 10:05-10:09. An unresolved jam can form one incident containing two stop segments. Physical stopped time is 7 minutes, not the 9-minute incident envelope. Production in the 2-minute interval is retained.

**Benchmark basis:** No universal ISO merge interval was verified. Two minutes is a proposed pilot parameter; 2-5 minutes in the questionnaire is not a validated global requirement.

**Plant confirmation:** OPS/MNT: review representative traces, successful-restoration criteria and equipment-specific grouping rules.

### D6. Micro-stop thresholds

**Meaning:** Decide which brief interruptions reduce the OEE performance factor and which are counted as availability downtime.

**Recommended answer:** Configure by asset class. For an automated bagging/conveyor line, pilot interruptions shorter than 120 seconds as micro-stops when operator-cleared and not a functional failure requiring maintenance. For a reactor or a significant process trip, record the trip as an event regardless of duration; do not apply a bagger threshold blindly. Retain all lost production once. The threshold changes the Availability/Performance split, not the underlying good-output loss.

**Worked example:** Ten 30-second bagger stops total 5 minutes. At 20 tonnes/hour they represent 1.67 tonnes. If classified as performance loss, those 5 minutes remain within the OEE run-time basis; do not subtract them again as availability loss. A protective reactor trip is still logged even if its signal lasts 30 seconds.

**Benchmark basis:** Vorne describes minor stops as typically a minute or two and gives a flexible tracking threshold [S4](https://www.oee.com/oee-six-big-losses/). The proposed 120-second setting is a trial choice, not a universal 2-5-minute standard.

**Plant confirmation:** OPS: approve thresholds after a representative event sample; review loss totals before and after changes.

### D7. Overlapping stop causes

**Meaning:** Decide which cause receives a time interval when two or more events overlap.

**Recommended answer:** Use first-out only as a provisional default when it represents the condition preventing production. Allocate one primary cause per lost interval/component; keep secondary causes. Reassign later time when the first cause clears and another condition still prevents restart. Equal splitting is not the default. Permit evidence-based correction with an audit trail.

**Worked example:** A motor stops the line at 10:00 and is restored at 10:30. A chute blockage begins at 10:05 and remains until 10:45. Assign 30 minutes to the motor and the next 15 to the chute: 45 minutes total, not 70. During overlap the chute is contributing, not another fully additive downtime charge.

**Benchmark basis:** This is a recommended conservation and causal-attribution rule. Event order alone does not establish root cause, and no universal first-out allocation mandate was verified.

**Plant confirmation:** OPS/MNT: define causal precedence for common overlaps and escalation for ambiguous cases.

### D8. Which events count as equipment failures?

**Meaning:** Define the numerator in equipment MTBF: what qualifies as one failure of the required equipment function?

**Recommended answer:** Count confirmed functional failures within the stated equipment boundary. Maintain critical and degraded categories and specify whether the headline metric combines them or reports separate values. A degraded failure can count even without a full unit stop. Exclude scheduled work, no-demand time, and external interruption when the equipment remains functional. An operator-induced event can still be an equipment failure if it causes actual loss of required function; classify the initiating cause separately.

**Worked example:** In 1,000 operating hours a pump has 2 qualifying mechanical failures and is stopped 5 times for loss of upstream feed. Equipment MTBF is 1,000/2 = 500 hours. A separate interruption metric could count all 7 stops, but must not be called the same equipment MTBF.

**Benchmark basis:** ISO 14224 provides equipment/failure/maintenance data structure [S5](https://www.iso.org/standard/64076.html); the published implementation paper supports distinct event datasets [S6](https://committee.iso.org/files/live/sites/tc67/files/news/OTC-28705-MS%20paper%20about%20ISO%20TC67%20standards%20in%20Houston%203%20May%202018.pdf). The failure-count policy must be stated explicitly.

**Plant confirmation:** MNT: failure definition, boundary, treatment of degraded/incipient findings and restoration criteria.

### D9. MTBF exposure and standby equipment

**Meaning:** Decide which hours form the denominator of a reliability rate, especially for equipment that rarely runs.

**Recommended answer:** Use verified operating exposure for an operating MTBF and show qualifying failures alongside it. Do not silently substitute calendar or scheduled hours. For standby assets separately record standby exposure, start demands, failed starts, tests and running hours. Assess demand failure and dormant failure using their relevant exposure, rather than adding standby hours to running MTBF. With zero failures, report exposure and zero observed failures; do not display a statistically proven infinite MTBF.

**Worked example:** A spare pump has 50 running hours, 20 start demands and 1 failed start. Its observed failed-start fraction is 1/20 = 5%. Reporting 8,760 calendar hours divided by that failed start as operating MTBF would be misleading.

**Benchmark basis:** NIST reliability guidance relates estimates and confidence to observed exposure and failures [S7](https://www.itl.nist.gov/div898/handbook/apr/section4/apr451.htm). Standby treatment above is recommended metric design aligned to the failure mechanism.

**Plant confirmation:** MNT: operating-hour signals, demand/test logs and whether an asset is evaluated for running, standby or demand performance.

### D10. Repair time versus total downtime

**Meaning:** Define what MTTR means and identify timestamps that can substantiate it.

**Recommended answer:** Use explicit names: mean active repair time and mean total restoration/downtime. For active repair, sum verified diagnosis, repair and required functional-test intervals according to the maintenance policy, excluding waiting for parts, permits or crews. Track failure detection, maintenance notification, active work, equipment-ready, and production-resumed times separately. A work order's creation and administrative closure are not reliable substitutes. Confirm the actual CMMS and available operation-level timestamps; the questionnaire does not establish them.

**Worked example:** Trip at 08:00; work starts 10:00; verified repair/test finishes 13:00; production resumes 14:00. If there are no active-work pauses, active repair is 3 hours, equipment restoration time is 5 hours, and production downtime is 6 hours.

**Benchmark basis:** ISO 14224 implementation guidance distinguishes failure and maintenance records [S6](https://committee.iso.org/files/live/sites/tc67/files/news/OTC-28705-MS%20paper%20about%20ISO%20TC67%20standards%20in%20Houston%203%20May%202018.pdf). MTTR terminology varies; these explicit definitions are proposed to prevent ambiguity.

**Plant confirmation:** MNT: SAP PM/Maximo/other source, timestamp meanings, pauses, tests and return-to-service sign-off.

### D11. Failure taxonomy and reason-code mapping

**Meaning:** Decide how equipment identity, failure symptoms, physical mechanisms and underlying causes are represented.

**Recommended answer:** Use an ISO 14224-aligned data dictionary for petrochemical equipment, mapping existing codes rather than deleting history. Treat equipment class, maintainable item, failure mode, mechanism, cause and detection method as related fields, not merely four mandatory levels in one dropdown. Preserve unknown/pending-investigation values where evidence is insufficient. Keep operations loss reasons separate from technical failure descriptions.

**Worked example:** Pump P-101; item = mechanical seal; mode = external leakage; mechanism = wear; cause = inadequate flush; detection = inspection. "Lubrication" alone is not a complete root-cause statement and must not be forced into every event just to complete a hierarchy.

**Benchmark basis:** ISO's published implementation paper describes taxonomy, staged data entry and failure/maintenance fields [S6](https://committee.iso.org/files/live/sites/tc67/files/news/OTC-28705-MS%20paper%20about%20ISO%20TC67%20standards%20in%20Houston%203%20May%202018.pdf). The attachment's four-level description is a simplification, not the entire ISO hierarchy.

**Plant confirmation:** MNT: current code export, asset hierarchy, crosswalk, code owner and approved equipment-class dictionaries.

### D12. Coding detail and deadlines

**Meaning:** Define the minimum explanation required for downtime and the time allowed to complete it.

**Recommended answer:** Require unit/asset, start/end, schedule status, primary impact category and responsible area before shift submission. Require a specific reason or an explicit investigation-pending status; add mechanism/root cause only when supported. Proposed pilot targets: at least 95% of stopped minutes categorized by shift end and 99% by daily approval, with all remaining minutes visible. Track counts and duration separately. Do not invent a root cause to meet completeness.

**Worked example:** For 200 stopped minutes, 190 categorized minutes meet the 95% shift target. At daily approval, 198 categorized minutes meet 99%; the remaining 2 minutes remain explicitly unknown with an owner. Five trivial coded stops cannot compensate for one uncoded two-hour event.

**Benchmark basis:** The 95% and 99% figures are proposed operating targets, not verified global benchmarks. ISO-aligned collection supports staged detail as evidence becomes available [S6](https://committee.iso.org/files/live/sites/tc67/files/news/OTC-28705-MS%20paper%20about%20ISO%20TC67%20standards%20in%20Houston%203%20May%202018.pdf).

**Plant confirmation:** OPS/MNT: mandatory fields by stage, deadline, material-event exceptions and review owner.

### D13. Coding roles, bulk coding and locking

**Meaning:** Decide who can code, verify and change reasons, including a bulk action affecting many stops.

**Recommended answer:** Operator enters; supervisor verifies; maintenance validates technical failure detail where needed; approved periods lock with versioned corrections. Require a common explanation and supporting evidence for a bulk-code action, with reason code, user, time and prior values retained for every event. Default to explicitly selected rows. Permit "all matching" only through an explicit action displaying the total count, affected dates/assets and a reviewable selection snapshot. Enforce permissions and checks on the server.

**Worked example:** The screen shows 25 rows but a filter matches 640. A bulk action must not silently change all 640. The user must explicitly choose that scope, see the count and confirm that the common explanation applies.

**Benchmark basis:** Independent review, documented controls and access boundaries are general internal-control principles [S8](https://www.gao.gov/greenbook). Exact roles, bulk-action behavior and lock points are recommended product policies.

**Plant confirmation:** OPS/PA: authorized roles, delegated reviewers and correction authority.

### D14. Default Pareto ranking

**Meaning:** Decide what "largest loss" means on the first chart a manager sees.

**Recommended answer:** Default the operational Pareto to gross lost good tonnes against a named baseline during eligible scheduled production. Offer duration, event count and validated economic impact as alternative rankings. Show recovery separately. Use the site final-product boundary for a site Pareto, and distinguish gross capacity opportunity from plan variance. Include calendar-time equipment faults in reliability reports where relevant, rather than deleting them globally.

**Worked example:** Cause A has 10 stops losing 5 tonnes; cause B has 1 stop losing 50 tonnes. A frequency Pareto ranks A first, but the production-tonnage Pareto ranks B first. If B's lost production was recovered, its permanent lost-sales value may be smaller than its gross tonnes suggest.

**Benchmark basis:** This is a reporting recommendation. There is no single universally correct Pareto metric; the chart must match the decision and denominator.

**Plant confirmation:** OPS/PA/FIN: default baseline, reporting boundary and trusted valuation view.

### D15. External causes and availability

**Meaning:** Resolve whether external conditions are inside or outside the main availability/OEE result.

**Recommended answer:** Keep external stops inside the headline operational OEE/availability when production was scheduled. Show an external-loss breakdown. A separate internal-equipment or controllable metric may exclude them, but must have its own name and denominator. Time genuinely not scheduled because of no demand is schedule loss, relevant to utilization/TEEP. Do not retrospectively remove an unexpected supplier or utility failure from the frozen schedule.

**Worked example:** An 8-hour scheduled shift loses 2 hours to grid power. Availability is 6/8 = 75%. A separately labelled internal-equipment view could be 100% if there were no internal losses. Those two figures answer different questions.

**Benchmark basis:** Vorne explicitly includes external starvation/blocking in line OEE [S3](https://www.oee.com/faq/). The questionnaire's final sentence saying external losses are always excluded from OEE contradicts that practice and its own earlier answer.

**Plant confirmation:** OPS/PA: list reports that need a supplemental controllable view; preserve the all-cause scheduled-production view.

### D17. Automatic RCA triggers

**Meaning:** Define when an event or recurring pattern merits a formal investigation.

**Recommended answer:** Use any-of triggers: serious actual or potential safety/environment/quality consequence; loss duration; lost tonnes; approved economic impact; and same-mode recurrence. Proposed non-safety pilot: at least 2 hours interruption OR 1% of the unit's daily planned tonnes OR 3 same-mode incidents in 30 days; halve production thresholds for critical assets. Finance must set the money limit. Treat these as triage settings to calibrate, not universal standards. Significant potential consequences override low monetary loss.

**Worked example:** At a 1,000-tonne/day plan, the pilot quantity threshold is 10 tonnes. Three 15-minute seal-leak incidents in 30 days can trigger review even if no single event reaches 2 hours. A hazardous release near miss triggers investigation even with zero lost tonnes.

**Benchmark basis:** These numerical triggers are proposed. As a sector-specific external benchmark, US OSHA PSM requires covered incident investigations to begin promptly and within 48 hours [S9](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.119); that is not asserted as Iranian law.

**Plant confirmation:** OPS/MNT/HSE/FIN: risk matrix, critical assets, money thresholds, recurrence identity and investigation ownership.

## Part B: Reconciliation workflow

### R1. Preparation and approval roles

**Meaning:** Decide who prepares the daily explanation, who independently checks it and who signs the monthly result.

**Recommended answer:** Use operations/production accounting as preparer, a different authorized supervisor or production-accounting reviewer as daily approver, and plant management plus finance for monthly sign-off. Route large losses, material manual adjustments and contested causes to an additional authorized reviewer according to materiality. A person who wrote any submitted line cannot independently approve that version; use a delegate if necessary.

**Worked example:** A production accountant prepares a day with 30 tonnes lost. A supervisor independently approves it. A day with an exceptional 200-tonne unresolved adjustment also requires plant management review, and finance approves its valuation. The 200-tonne figure here illustrates routing, not a proposed global threshold.

**Benchmark basis:** Segregation of incompatible duties is a general internal-control principle [S8](https://www.gao.gov/greenbook). Exact role names, materiality levels and monthly sign-offs are recommended plant governance.

**Plant confirmation:** OPS/PA/FIN: named role matrix, authorized delegates and materiality bands.

### R2. Shift, daily and monthly reconciliation

**Meaning:** Decide the official approval period without losing shift-level accountability.

**Recommended answer:** Record and review at shift level, reconcile the official production day, and close the financial month. Store each physical quantity once and roll it up consistently; daily totals must not be created independently of overlapping shift totals. Define the production day boundary, site time zone and grade/lot allocation. If the business requires shift approval, make daily approval certify the roll-up and any cross-shift adjustments.

**Worked example:** Three shifts report 100, 110 and 90 tonnes. The day is 300 tonnes, not 300 plus the three shift entries. A 10-tonne lab reclassification changes the relevant shift/lot and the day's quality split once.

**Benchmark basis:** Daily reconciliation with shift detail is a recommended operating model, not a universal ISO-mandated period.

**Plant confirmation:** OPS/PA: production-day start, shift patterns, daily approver and financial calendar.

### R3. Daily deadlines and escalation

**Meaning:** Set a service level for finishing production reconciliation and define the response to delay.

**Recommended answer:** Proposed pilot: submit within 12 hours of production-day end and approve within 24 hours when final measurements are available. Remind the preparer and checker when due; escalate unresolved delay at 48 hours to the production-accounting manager and at 72 hours to plant management. Separately track waiting-for-lab or failed-source exceptions; do not invent actuals or auto-approve to meet a clock. Site working hours may change notification timing, not the recorded age.

**Worked example:** A production day ends at 06:00 Monday. Submission is due by 18:00 Monday and approval by 06:00 Tuesday. An unresolved Wednesday 06:00 record is 48 hours old and escalates.

**Benchmark basis:** 12/24/48/72 hours are proposed service levels. No universal 24-48-hour plant-reconciliation benchmark was verified.

**Plant confirmation:** OPS/PA/MET: lab turnaround, weekend staffing, reminder recipients and exception ownership.

### R4. Monthly hard close

**Meaning:** Decide when approved monthly figures become locked and how later corrections are controlled.

**Recommended answer:** Adopt a named working-day close calendar. Proposed target: operational quantity close by working day 3 and finance sign-off by working day 5, subject to source readiness. Keep original approved versions and use a controlled correction workflow after locking. A hard close does not authorize concealing errors; accounting treatment follows the applicable reporting policy.

**Worked example:** If month-end is followed by a holiday, working day 5 is counted using the approved site/company holiday calendar, not five calendar days. A later meter correction remains linked to the affected original production period.

**Benchmark basis:** APQC measure 104615 reports a median monthly financial-close cycle of 8.0 days across 3,389 organizations [S10](https://www.apqc.org/what-we-do/benchmarking/open-standards-benchmarking/measures/cycle-time-days-finance-shared). This broad cross-industry measure is not identical to a plant's working-day-5 deadline. Working days 3/5 above are proposed targets, not APQC quartiles.

**Plant confirmation:** PA/FIN: close calendar, trial-balance/reporting milestones and post-close correction authority.

### R5. Late measurements after approval

**Meaning:** Decide whether a late lab result or corrected meter rewrites history, reopens a period, or goes into the current period.

**Recommended answer:** For the production ledger, create a restated version of the original affected period, retain the original approved version, show the delta and require re-approval. Before monthly close, this can appear as controlled reopening, but historical versions remain immutable. Keep operational effective date separate from financial posting date. Finance determines whether any general-ledger effect is a correction, an estimate change or another adjustment; do not apply one automatic financial restatement rule to all late information.

**Worked example:** A day originally reports 100 good tonnes. A final lab result reclassifies 5 tonnes as off-grade. The restated day shows 95 good and 5 off-grade; total mass remains 100. The old approval remains accessible, and finance decides the posting treatment.

**Benchmark basis:** Versioned production restatement is recommended. IAS 8 distinguishes errors from changes in estimates, which can have different accounting treatments [S11](https://www.ifrs.org/issued-standards/list-of-standards/ias-8-basis-of-preparation-of-financial-statements/).

**Plant confirmation:** PA/MET/FIN: source revision IDs, effective-period rules, materiality and approval route.

### R6. Rejected approvals

**Meaning:** Decide who fixes a rejected reconciliation and how repeat rejection is handled.

**Recommended answer:** Return it to the named preparer, preserving the rejected version and a mandatory actionable reason. Show which line or control failed, who owns the correction and the new due time. Proposed rule: escalate a third rejection of the same period/version lineage to the production-accounting manager for support. Escalate serious unsupported changes immediately; repeated rejection must never force automatic approval.

**Worked example:** A checker rejects a 25-tonne claim because the event supports only 15. The task returns to its preparer with the event reference and the 10-tonne discrepancy. A corrected submission is a new reviewable version.

**Benchmark basis:** This is a proposed workflow control. Three rejections is a configurable escalation choice, not an industry standard.

**Plant confirmation:** OPS/PA: reassignment/delegation, correction deadlines and escalation owner.

### R7. Approval of unexplained loss

**Meaning:** Decide whether an honestly labelled residual can be accepted and how its size is judged.

**Recommended answer:** Allow an explicit unexplained residual only within approved measurement/materiality limits, with a category, reason, owner and reviewer. Suggested categories: supported measurement adjustment, timing/inventory difference, source-data gap and unexplained cause. An unsupported residual stays unexplained; its label is not proof of metering error. Track both residual tonnes/plan tonnes and residual tonnes/gross loss tonnes. Proposed improvement target: drive unexplained loss below 2% of gross losses; this is not the approval tolerance and is undefined when gross loss is zero.

**Worked example:** Plan = 1,000 tonnes; actual = 900; explained net losses = 90. Residual = 10 tonnes: 1% of plan but 10% of the 100-tonne shortfall. A rule allowing 2% of plan could hide poor cause coverage. Whether the day may close depends on the separate approved tolerance and materiality.

**Benchmark basis:** GE PLA exposes unaccounted loss and configurable reconciliation tolerance [S12](https://www.ge.com/digital/documentation/onpremises-apm/v513/help/pdf/Production_Loss_Analysis.pdf). The 2% improvement target is proposed; no universal 2-5% allowance was verified.

**Plant confirmation:** PA/MET: denominator, signed residual treatment, metrology allowance and escalation limits.

### R8. Manual bridge lines

**Meaning:** Define when a manual adjustment may close a remaining reconciliation gap.

**Recommended answer:** Restrict entry to authorized production accounting, require a reason and evidence, and require an independent approver. Set the limit by unit measurement uncertainty and finance materiality; no generic percentage is defensible. Keep supported inventory/timing/measurement adjustments separate from an unexplained residual. A bridge cannot override an impossible loss claim, hide a duplicate or bypass an approval block. A second independent period reviewer can satisfy review unless the materiality policy requires an additional specialist.

**Worked example:** Metered transfer is 100 tonnes but receipt is 98. A verified 2-tonne increase in in-process inventory supports a timing/inventory bridge. If there is no evidence of inventory movement, label the 2 tonnes unexplained rather than fabricating that adjustment.

**Benchmark basis:** Documented review is an internal-control principle [S8](https://www.gao.gov/greenbook); uncertainty-based limits follow measurement principles [S13](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-5-combined-standard-uncertainty). The bridge workflow is a recommendation.

**Plant confirmation:** PA/MET/FIN: authorized users, evidence types and per-unit absolute/relative limits.

### R9. Over-explanation and negative lines

**Meaning:** Decide whether a negative adjustment can be used when claimed losses exceed the observed shortfall.

**Recommended answer:** Reject unsupported negative balancing lines. First check duplicated intervals, wrong rates, quality double counts, timing and grade allocation. Permit genuine measured recovery gains and evidence-backed reversals of erroneous entries as their own types. A gain does not increase the maximum physical loss an event can support. Apply conservation at interval/event level as well as period level.

**Worked example:** Plan 1,000; actual 920; measured gross losses 100; measured recovery 20. The correct bridge is 1,000 - 100 + 20 = 920. If the 20-tonne recovery has no evidence, entering "-20 balancing" merely hides over-accounting and must not permit approval.

**Benchmark basis:** This is an arithmetic and control recommendation. "No netting" should preserve gross visibility, not prohibit legitimate recovery gains in the final balance.

**Plant confirmation:** PA: allowed gain/reversal types and evidence; enforce impossible-claim checks before balancing.

### R10. Conservation across periods and lines

**Meaning:** Decide how one event can be split without claiming its physical consequence more than once.

**Recommended answer:** Allow allocation across shifts, days, grades and reporting lines, but enforce conservation within the same boundary, baseline and quantity basis. The sum of allocations must equal the approved event loss when fully allocated, and must never exceed it. Recalculate the event total through controlled versioning if evidence changes. Plan and capacity views are alternative measurements, not allocations to add together. Linked impacts on different units need site-level consolidation.

**Worked example:** A 3-hour event at a constant 20 tonnes/hour crosses a shift boundary after 1 hour. Allocate 20 tonnes to shift A and 40 to shift B, totaling 60. Claims of 30 and 40 exceed the event total by 10 and fail validation.

**Benchmark basis:** Conservation is a mathematical requirement of the proposed ledger, not a tolerance-based preference.

**Plant confirmation:** PA: authoritative event total, rate version, allocation dimensions and consolidated boundary.

### R11. Evidence for manual loss lines

**Meaning:** Define the minimum proof required for each manually entered quantity.

**Recommended answer:** Require author, reason code, explanation, unit/grade, interval, quantity/unit, calculation basis and a source reference. Tailor evidence: downtime needs an event/log/work-order reference; rate loss needs rate or totalizer evidence; quality loss needs lot/sample and disposition; inventory adjustment needs a movement or stock record. Do not require a photo for every line or mistake a photo for quantitative proof. An allowed unexplained residual records the investigation and missing evidence explicitly.

**Worked example:** A manual 12-tonne off-grade loss links sample L-204 and lot B-108, the measured lot quantity, failed specification and approved disposition. A photo of discolored pellets alone does not justify 12 tonnes.

**Benchmark basis:** This is a recommended evidence contract, supported by general documentation controls [S8](https://www.gao.gov/greenbook). The same evidence must be accessible to the reviewer.

**Plant confirmation:** OPS/PA/MET: evidence requirements by line type and retention/access arrangements.

### R12. Approved versus provisional reporting

**Meaning:** Decide what the default dashboard and official reports are allowed to present as final.

**Recommended answer:** Default signed daily/monthly management reports to approved versions. Live operational dashboards may show provisional values with visible status, as-of time and coverage. Show draft/restated/approved series distinctly. Never silently exclude missing approvals and present the remaining subset as a complete plant total. Provide the count and production coverage of unapproved periods.

**Worked example:** A month has 28 approved days and 2 provisional days. Show the approved subtotal and a labelled provisional full-month estimate, or withhold certification. A total from 28 days must not be titled "final monthly production".

**Benchmark basis:** This is a proposed reporting-control policy. A useful real-time dashboard and an official approved statement serve different purposes.

**Plant confirmation:** PA/FIN: default report modes, coverage display and treatment of missing approvals.

### R13. Which external statuses are final?

**Meaning:** Define how a source system's workflow status becomes a trusted actual-production record.

**Recommended answer:** Use an explicit per-source status mapping approved by the source owner. Do not assume COMPLETED means released: it may mean laboratory testing or data entry finished before review. Accept RELEASED only if that source uses it for the authorized final record, and also check revision, quality flags, cancellations and supersession. Retain source ID, revision, approval/release time and ingestion time.

**Worked example:** In a LIMS, COMPLETED can mean the analyst entered results, while AUTHORIZED means a quality reviewer released them. Only AUTHORIZED is final for that source. In another system RELEASED may be the correct state; the mapping must reflect its documented workflow.

**Benchmark basis:** No cross-vendor universal status vocabulary was verified. This is a source-contract and traceability requirement, not a rule to hard-code two English status strings.

**Plant confirmation:** PA/MET: source workflow documentation, authorized status set and corrected/recalled-record behavior.

## Part C: Valuation

### V1. Approval of valuation policies

**Meaning:** Decide who can authorize the rates that turn operational quantities into money.

**Recommended answer:** Create separate finance-maintainer and finance-approver permissions. Finance approves cost definitions, margins, price versions, exchange-rate sources and effective dates. Commercial/procurement teams may supply price evidence; operations supplies physical impact and can propose corrections, but cannot approve financial rates. Production managers normally have read/use access to approved rates. Preserve the submitting and approving identities and prohibit self-approval.

**Worked example:** Commercial proposes a $300/tonne margin; finance validates the variable-cost basis and approves it effective 1 October. Operations can use it for a 20-tonne event, but cannot change it to $500/tonne to inflate a project saving.

**Benchmark basis:** This is a governance recommendation based on independent control principles [S8](https://www.gao.gov/greenbook); no standard prescribes these exact application role names.

**Plant confirmation:** FIN: designated rate owners/approvers, commercial inputs and access rights.

### V2. Scrap, downgrade and rework valuation

**Meaning:** Distinguish product never made, material made and scrapped, material sold below intended grade, and material successfully recovered.

**Recommended answer:** Use an explicit counterfactual and show non-overlapping economic components. Unproduced, unrecovered sales: lost contribution. Scrap: unrecovered sales contribution plus wasted variable production spend, less salvage, plus incremental disposal costs. If the sale is recovered, do not retain its full lost contribution. Downgrade sold: net revenue difference plus incremental handling/disposition costs. Successful rework: incremental reprocessing costs, yield losses and any evidenced contribution displaced at a bottleneck. Book inventory write-offs separately under finance policy; they are not identical to economic opportunity loss.

**Worked example:** Illustration: price $1,000/t, avoidable production cost $700/t, contribution $300/t. Ten tonnes not made and never sold lose $3,000. Ten fully produced tonnes scrapped with no replacement sale and $50/t salvage lose $3,000 + $7,000 - $500 = $9,500. Ten tonnes sold at $800/t instead lose $2,000 before other incremental costs. Ten tonnes reworked for $60/t with full sales recovered and spare capacity cost $600, not another $3,000 of lost contribution.

**Benchmark basis:** The worked model is a recommendation applying relevant-cash-flow logic [S14](https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/relevant-costs.html). IAS 2 separately addresses inventory cost/write-down recognition [S15](https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/). The questionnaire's simple formulas need these assumptions.

**Plant confirmation:** FIN/MET: actual net prices, variable cost already incurred, salvage, recovery yield, replacement sales and bottleneck opportunity.

### V3. Does every lost tonne represent a lost sale?

**Meaning:** Decide when physical production loss causes an actual commercial opportunity loss.

**Recommended answer:** Record sold-out/demand-limited status as an initial indicator, then substantiate unmet demand, inventory cover, ability to catch up, timing and the affected market. Charge lost contribution only for sales genuinely forgone within the defined evaluation horizon. Separately show repair, restart, wasted material, penalties and incremental catch-up costs. Variable costs avoided by not making unsold product are a saving, not a positive loss. Capacity opportunity can remain visible in tonnes even when lost-sales value is zero.

**Worked example:** A stop prevents 20 tonnes at $300/t contribution. If orders are permanently lost, opportunity loss is $6,000. If inventory serves every order and production catches up without displacing sales, lost-sales contribution is $0; a $1,000 restart expense still remains.

**Benchmark basis:** ACCA explains relevant cost through changed cash flows and contribution forgone [S14](https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/relevant-costs.html). The demand and recovery tests above are a proposed operational valuation method.

**Plant confirmation:** FIN/OPS/commercial: demand evidence, inventory cover, recovery horizon and incremental cost sources.

### V4. Hourly values for manual loss entries

**Meaning:** Decide whether manually entered quantities can use the same downtime-cost view as automatic events.

**Recommended answer:** Apply the same eligibility rules regardless of entry method, but require verified attributable hours for an hourly cost. A manual downtime segment may qualify; an off-grade-tonnage or unexplained-quantity line does not automatically imply idle hours. Show equivalent downtime only as a separately labelled derived measure if needed. Prevent two lines charging the same asset-hours twice. Identify fixed-cost/labor absorption views as allocated costs rather than necessarily incremental economic losses.

**Worked example:** A documented manual 2-hour outage at an approved $500/hour rate gives $1,000 in the hourly-cost view. A 10-tonne off-grade batch produced while running has no evidence of a 2-hour outage and cannot receive that charge merely by dividing by a rate.

**Benchmark basis:** The equal-treatment principle is recommended, with dimensional validation. Relevant-cost guidance distinguishes incremental cash effects from unchanged committed costs [S14](https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/relevant-costs.html).

**Plant confirmation:** FIN: composition of hourly rate, eligible loss types and prevention of overlap with margin/cost components.

### V5. Which USD/IRR exchange-rate basis?

**Meaning:** Decide which conversion makes each report meaningful where different exchange mechanisms or reporting purposes exist.

**Recommended answer:** Keep a named, dated rate policy per purpose: internal realized-economic view should use finance/treasury's evidenced applicable conversion basis; head-office reporting should use the group's approved accounting/translation policy. A budget/constant-currency view may be added separately for comparison. Do not automatically choose the cheapest published rate or hard-code historic market labels such as NIMA. Record rate source, accessibility assumptions, direction, currency unit and approval. Where IFRS applies, finance must assess exchangeability rather than assume any quoted official rate is usable.

**Worked example:** Using purely hypothetical rates, a 600 million IRR loss is $1,000 at 600,000 IRR/USD and $750 at 800,000 IRR/USD. Both can appear in explicitly labelled views; do not mix their converted values into one total. Distinguish IRR from any toman-denominated source.

**Benchmark basis:** IAS 21 addresses currency translation; lack-of-exchangeability amendments apply from periods beginning 1 January 2025 [S16, S17]. These do not dictate a universal rate for a management loss dashboard.

**Plant confirmation:** FIN/treasury: functional/reporting currencies, actual eligible source, units and separate internal/group policy IDs.

### V6. Exchange-rate date and monthly aggregation

**Meaning:** Decide whether to value each loss at its event-date rate, a monthly average or a closing rate.

**Recommended answer:** For the operational economic view, use an approved event-date rate and sum the resulting daily values into the month. A monthly-average view is optional when the rate reasonably approximates the relevant daily rates; do not assume it is always acceptable during volatility. Month-end rates serve specified accounting balance translations, not automatically every historical operational loss. Keep budget-rate comparisons separate. For accounting reports, finance applies the relevant recognition/translation basis.

**Worked example:** Two losses of 600 million IRR occur at 600,000 and 750,000 IRR/USD. Event-date values are $1,000 and $800, totaling $1,800. Dividing 1.2 billion IRR by the simple average 675,000 gives $1,777.78. The difference proves that methods cannot be silently interchanged.

**Benchmark basis:** AASB 121, the publicly available IAS 21-equivalent standard, permits approximating averages but says they are inappropriate when rates fluctuate significantly [S18](https://standards.aasb.gov.au/aasb-121-oct-2023).

**Plant confirmation:** FIN: default date basis, treatment of multi-day events, averaging method and materiality of approximation.

### V7. Late-approved exchange rates

**Meaning:** Decide whether a missing or revised financial rate changes already-approved production reports.

**Recommended answer:** Separate quantity approval from valuation approval. A period may have approved tonnes and a monetary status of not valued; missing value is not zero. An authorized provisional rate may support a clearly provisional financial view. When the approved historical rate arrives, create a valued version using its approved effective date. Preserve any previously approved valuation and require finance-controlled restatement to replace it. Late rate approval must not change the underlying lost tonnes.

**Worked example:** An approved 50-tonne loss has a local value of 30 million IRR but no approved USD rate. It shows 50 tonnes, 30 million IRR and USD not valued. At a hypothetical 600,000 IRR/USD approved later, a new financial version shows $50 with the rate ID and approval date.

**Benchmark basis:** This is recommended versioning and valuation governance. It does not mean restating financial statements is automatically appropriate for every late rate [S11, S16].

**Plant confirmation:** FIN/PA: provisional-rate permission, valuation states and financial-restatement authorization.

### V8. Default management value view

**Meaning:** Decide which of the available monetary measures managers should see first.

**Recommended answer:** Default to validated economic impact: lost contribution on unrecovered sales plus distinct incremental event costs, with assumptions visible. If the system currently supports only contribution margin, standard cost and hourly cost, use contribution opportunity as the default when demand/recovery evidence supports it, and show tonnes plus valuation status otherwise. Accounting users can default to the approved cost/write-off view. Keep all views available but never add the full views together.

**Worked example:** An event displays $6,000 contribution opportunity, $14,000 standard-cost equivalent and $2,000 hourly cost absorption. These are alternative perspectives, not a $22,000 total. A separately evidenced $500 incremental repair charge can be added to an economic impact only if it is not already included.

**Benchmark basis:** Relevant-cost analysis and inventory accounting answer different questions [S14, S15]. The default view is a management-policy choice.

**Plant confirmation:** FIN/OPS: approved economic components, demand/recovery evidence and audience-specific defaults.

## Part D: RCA and corrective actions

### CA1. Independent RCA closure

**Meaning:** Decide who confirms that an investigation can close and whether completed tasks alone are enough.

**Recommended answer:** Require an independent authorized reviewer, normally the reliability/production manager, with quality or HSE participation where relevant. Separate investigation accepted, actions implemented and effectiveness verified. Do not close as effective just because the investigator entered a root cause and marked actions done. Require evidence supporting the cause, completed actions, effectiveness results and disposition of residual risk. Prevent investigator self-approval of closure.

**Worked example:** An investigator replaces a seal and closes the work order. The RCA stays in effectiveness monitoring until agreed tests and service exposure show the corrective action met its criteria; a different reviewer then approves closure.

**Benchmark basis:** FDA's published MDSAP corrective-action procedure requires documented effectiveness before successful completion [S19](https://www.fda.gov/medical-devices/medical-device-single-audit-program-mdsap/mdsap-qms-p0009-nonconformity-and-corrective-action-procedure). It is a cross-sector practice example, not a regulation asserted to apply to this polymer plant. Independent approval is the proposed governance.

**Plant confirmation:** MNT/OPS/HSE/quality: closure roles, delegation and evidence criteria.

### CA2. Effectiveness monitoring and exposure

**Meaning:** Decide how long to watch after a fix and what evidence demonstrates improvement.

**Recommended answer:** Set the target and minimum relevant exposure before implementation. Use 90 calendar days as a proposed review checkpoint, not automatic proof of success. Require comparable operating hours, cycles or start demands and operating conditions; select a minimum exposure from the failure frequency and criticality. Exclude planned non-operating time from a running-exposure denominator, but retain standby time where the mechanism is dormant. Use effective, ineffective and insufficient-evidence states. For high-consequence failure modes, a repeat demands review even if the average rate improved.

**Worked example:** Before: 5 same-mode failures in 1,000 operating hours. After: 1 in 1,000 hours, an observed rate reduction of 80%, subject to uncertainty. Zero failures in 900 hours only gives an approximate 95% lower MTBF bound of 900/2.996 = 300 hours under a constant-rate model; it does not prove infinite reliability.

**Benchmark basis:** NIST provides exposure-based reliability estimates and zero-failure confidence limits [S7](https://www.itl.nist.gov/div898/handbook/apr/section4/apr451.htm). Ninety days and any acceptance percentage are proposed case-specific choices.

**Plant confirmation:** MNT: baseline, exposure target, acceptance test, uncertainty assessment and response to a repeat.

### CA3. Source and control of the baseline

**Meaning:** Decide whether an investigator may type the before-fix performance or must use recorded history.

**Recommended answer:** Calculate a proposed baseline from verified events/exposure for the same asset and failure mode. Start with a 90-day lookback for frequently recurring faults; extend it where evidence is sparse or seasonal. Match duty, grade and load where relevant. Freeze the dataset/query/version when the case is approved. Permit a justified independently approved correction or alternate baseline; do not restrict experts to comments when the underlying data is wrong.

**Worked example:** The system finds 4 seal leaks in 800 operating hours, giving 5 failures per 1,000 hours. One record proves to be a duplicate. An approved correction produces 3/800 = 3.75 per 1,000 hours while retaining the original baseline and explanation.

**Benchmark basis:** Data-derived and versioned baselines are recommended. Comparable exposure and uncertainty matter more than an arbitrary fixed calendar window [S7](https://www.itl.nist.gov/div898/handbook/apr/section4/apr451.htm).

**Plant confirmation:** MNT: failure-mode matching, lookback, duty matching, baseline approval and correction rules.

### CA4. Evidence that an action is done

**Meaning:** Define what must accompany an action before it can be marked implemented.

**Recommended answer:** Require objective evidence suited to the action plus a verifier and completion date. Repair: work-order operation and acceptance test. Design change: approved drawing/change record and commissioning evidence. Procedure change: released revision plus implementation/training evidence. Instrument change: calibration/test results. A photo can supplement evidence but is not universally sufficient. Keep action completion separate from longer-term effectiveness.

**Worked example:** "Improve lubrication" is incomplete. Evidence could include the revised lubrication instruction, revised maintenance task, correct lubricant issue record and an inspection/test confirming execution. A photo of a grease gun alone does not prove the process changed.

**Benchmark basis:** Published corrective-action guidance separates implementation evidence from effectiveness review [S19](https://www.fda.gov/medical-devices/medical-device-single-audit-program-mdsap/mdsap-qms-p0009-nonconformity-and-corrective-action-procedure). These evidence types are recommended plant controls.

**Plant confirmation:** MNT/OPS: evidence checklist by action type and independent verification authority.

### CA5. FMEA scoring: RPN or Action Priority?

**Meaning:** Decide how failure risks are prioritized and how incomplete scores are handled.

**Recommended answer:** For a petrochemical plant, use IEC 60812 as the generic FMEA framework and approve a severity-led criticality/risk policy. Adopt AIAG-VDA Action Priority if the organization deliberately chooses it or a customer requires it; it is not a universal process-industry mandate. If RPN remains, do not rely only on a cutoff of 100: require high-severity review regardless of product score. Keep missing ratings null; allow draft saving but block final approval of required incomplete ratings. Associate detection with the specific cause/failure chain and actual detection control, which may detect the cause or the failure mode; do not assign one blanket effect-level score.

**Worked example:** S=10, O=2, D=2 gives RPN 40. S=5, O=5, D=5 gives RPN 125. A threshold of 100 alone could ignore the more severe first case. This example illustrates RPN limitations; it does not assert either case's AIAG-VDA AP rating, which must come from the adopted table.

**Benchmark basis:** IEC 60812 supports tailored FMEA and different prioritization approaches [S20](https://webstore.iec.ch/en/publication/26359). AIAG-VDA introduced AP in its automotive handbook [S21](https://www.aiag.org/docs/default-source/quality-/new_aiag_vda_fmea_-whitepaper.pdf?sfvrsn=6923e9d_4).

**Plant confirmation:** MNT/MET/HSE: selected method/edition, rating anchors, severity overrides, approved tables and missing-data gates.

### CA6. Must a 5-Why analysis contain five levels?

**Meaning:** Decide whether the number of answers is an approval rule or simply a prompt for deeper thinking.

**Recommended answer:** Treat five as guidance. Enforce evidence, causal logic, scope and an actionable system-level cause, not a minimum count. The reviewer may accept fewer steps or request more and branching. Do not accept unsupported "operator error" as the final explanation. Implement the required content/approval checks on the server as well as the screen.

**Worked example:** Belt slips because tension is low; tension is low because the tensioner is seized; it seized because contamination protection and inspection were inadequate. If evidence supports these links, the team can act after three substantive levels. Adding two invented answers makes the analysis worse.

**Benchmark basis:** ASQ explicitly states that reaching a root cause can take fewer or more than five questions [S22](https://asq.org/quality-resources/five-whys).

**Plant confirmation:** OPS/MNT: reviewer rubric for evidence and causal sufficiency, rather than a numeric depth gate.

### CA7. Investigation methods by consequence

**Meaning:** Decide how much investigative rigor and which tools each event needs.

**Recommended answer:** Use a risk-based tier, considering actual and potential consequences, recurrence, uncertainty and cross-unit reach. Proposed tier 1: low-consequence isolated event, documented problem solving/5-Why. Tier 2: significant or recurring loss, cross-functional team, timeline, evidence and cause analysis such as fishbone plus tested causal chains. Tier 3: major/potentially major safety, environmental or systemic event, independent facilitated team and appropriate barrier/fault-tree or other formal analysis. Do not mandate a fault tree for every major event irrespective of suitability.

**Worked example:** A one-off minor packaging jam can use tier 1. Repeated extruder trips affecting supply merit tier 2. A hazardous-release near miss deserves tier 3 even if production loss is zero.

**Benchmark basis:** ASQ supports use of complementary cause-analysis tools [S22](https://asq.org/quality-resources/five-whys); OSHA PSM is a sector-specific example of investigation driven by actual or potential severe consequence [S9](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.119). Exact tiers are proposed.

**Plant confirmation:** OPS/MNT/HSE: severity matrix, approved methods, facilitator competence and escalation rules.

### CA8. Repeats, financial triggers and bad actors

**Meaning:** Decide how chronic failures trigger investigation and how open cases receive new evidence.

**Recommended answer:** Count repeats at least by asset plus failure mode; refine by mechanism/cause once known. Add validated economic-impact and rolling cumulative-loss triggers. Proposed bad-actor review: monthly review of the top 5 assets/modes over a rolling 90 days, with materiality screening. Link same-problem repeats to an open case and escalate its recurrence count; do not suppress distinct problems merely because one case exists on that asset. A new failure mode can need a separate linked case.

**Worked example:** P-101 has an open seal-leak RCA. A new seal leak links to it and triggers reassessment. A motor insulation failure on P-101 is not automatically swallowed by that case. Ten small jams losing 100 tonnes in aggregate can justify RCA without a single large stop.

**Benchmark basis:** This is a proposed prioritization and case-linking policy. Top 5, 90 days and the recurrence thresholds in D17 are pilot settings, not international requirements.

**Plant confirmation:** MNT/FIN: asset-mode identifiers, cost basis, cumulative window and open-case matching criteria.

### CA9. Sharing lessons between plants

**Meaning:** Decide which cases are visible elsewhere and which solutions deserve promotion as proven practice.

**Recommended answer:** Share approved factual lessons across authorized plants, with ownership, equipment/process applicability, evidence and version history. Promote a corrective solution as verified practice only after effectiveness approval. Share urgent warnings and unsuccessful actions earlier with clear status; withholding them until successful closure can delay learning. Remove personal/confidential details as required. Receiving plants must assess fit and use their own change-control process before copying a modification.

**Worked example:** A verified seal-flush improvement on an HDPE pump is suggested to another plant with similar service. The second plant checks process chemistry, operating envelope and design requirements before applying it. A failed seal-material trial is also shared as a caution, not a success story.

**Benchmark basis:** OSHA investigation guidance includes communicating relevant findings to affected personnel [S9](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.119). Cross-plant knowledge sharing and promotion rules are recommended organizational policy.

**Plant confirmation:** OPS/MNT: organization access, redaction, case status labels and local adoption approval.

## Part E: Plant data and reference templates

### E1. Grade-transition and ramp-up standards

**Meaning:** Provide the actual reference times and loss profiles needed to evaluate each grade change and restart.

**Recommended answer:** Build a directional from-grade/to-grade matrix by unit, catalyst family and operating mode. Define start/end at a consistent measurement/quality boundary, with total transition duration, gross rate deficit, off-grade quantity and approved planned allowances. Derive reference values from validated comparable transitions and licensor/engineering guidance; no universal HDPE hours value is defensible. For trip recovery, retain stopped, ramp-up rate and startup-quality components linked to the originating event.

**Worked example:** Illustrative A-to-B observations are 1.8, 2.0, 2.1, 2.3 and 2.8 hours. Their median is 2.1 hours; this small sample is only an initial estimate. A 3-hour transition is 0.9 hour above that reference, but loss tonnes require the actual rate/quality profile. B-to-A may have a different reference.

**Benchmark basis:** Polyethylene transition research identifies process/operational constraints as determining transition behavior [S23](https://www.sciencedirect.com/science/article/pii/S1570794603805886). The data template and estimation method are recommended.

**Plant confirmation:** OPS/process engineering: unit, from/to grades, catalyst, boundary, sample count, reference hours/tonnes, allowed profile, evidence, approver and effective date.

### E2. Plant flow and buffers

**Meaning:** Describe which units feed one another and how inventory delays or absorbs production consequences.

**Recommended answer:** Provide a directed material-flow map, including alternate routes, conversion yields, unit capacities, shared utilities, buffer/silo usable inventory and operating limits. Propagate effects using current usable inventory and throughput, not immediate one-to-one copying of upstream downtime. Evaluate final loss at the agreed site/product boundary. An upstream interruption can consume buffer without immediately losing a sale.

**Worked example:** A reactor feeds an extruder through 100 usable tonnes of buffer. At 20 tonnes/hour the buffer provides 5 hours of cover. A 2-hour reactor stop need not stop the extruder. A 7-hour stop can produce 2 hours of starvation and 40 tonnes of downstream loss, assuming no other changes or recovery.

**Benchmark basis:** This is an engineering mass-flow and inventory model. OEE guidance emphasizes the constraint and upstream/downstream effects [S3](https://www.oee.com/faq/); actual propagation needs plant topology.

**Plant confirmation:** OPS/process engineering: tagged flow diagram, usable inventory limits, rates, yield factors, routes and buffer-level data.

### E3. Good-output boundary and product disposition

**Meaning:** Identify where quantity becomes accountable product and what qualifies as first-pass conforming output.

**Recommended answer:** Select a reliable production measurement boundary and link quantities to lots and approved quality dispositions. Keep first-pass good, intentional wide-spec grade, downgraded/off-grade, scrap and rework/recycle movements distinct. Do not count recycled material twice as net new output. Align lab results to the relevant production interval/lot, not merely the time the lab released them. Finance supplies grade-specific net price differences and actual incremental disposition costs.

**Worked example:** A 100-tonne lot contains 95 conforming tonnes and 5 downgraded tonnes. First-pass quality is 95%. If those 5 sell for $800/t against intended $1,000/t, revenue downgrade is $1,000. Reprocessing them later can recover saleable output but does not erase the first-pass defect or create 105 tonnes of net product.

**Benchmark basis:** OEE quality uses first-pass conforming output [S24](https://www.oee.com/calculating-oee/). Price-difference and rework valuation require the assumptions described in V2, not an OEE percentage conversion.

**Plant confirmation:** MET/OPS/FIN: quantity tag/boundary, lot/sample linkage, disposition rules, recovery movements and approved net-price versions.

### E4. Justified reconciliation tolerance

**Meaning:** Quantify the uncertainty and materiality that support accepting a residual for each measurement boundary.

**Recommended answer:** Prepare an uncertainty budget covering meters, scales, inventory, density/moisture conversion, timing and correlations. Distinguish instrument accuracy specifications from uncertainty of the whole reconciliation. Do not label 0.5-2% or another generic range a standard. Keep automatic write-off/absorption disabled until a tolerance is justified; a zero default means no authorized automatic adjustment, not physically perfect metering. Publish residuals separately even when within an approved allowance.

**Worked example:** If two independent mass readings each have standard uncertainty 3 tonnes, the difference has combined standard uncertainty sqrt(3^2 + 3^2) = 4.24 tonnes. With coverage factor 2, expanded uncertainty is about 8.5 tonnes. This simplified example omits inventory and correlation; it informs, but does not automatically set, the acceptance rule.

**Benchmark basis:** NIST explains combining uncertainty components and covariance [S13](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-5-combined-standard-uncertainty). The plant must translate that evidence into its own acceptance and investigation policy.

**Plant confirmation:** MET/PA: calibration evidence, uncertainty model, denominator, absolute and relative thresholds, approval and review date.

### E5. Planned and sustainable rates

**Meaning:** Provide the actual production baselines used by each unit and grade.

**Recommended answer:** Maintain separately: time-specific planned rate, approved sustainable capability, nameplate/design reference and OEE ideal rate where used. Specify whether each rate is gross or first-pass-good output and its measurement boundary. Process engineering recommends capability, operations validates duty/quality constraints, and planning owns the production target; approval is versioned. Proposed governance: quarterly exception review and annual formal confirmation, plus review after plant/product changes. Do not lower capability automatically because recent performance deteriorated.

**Worked example:** For one grade, nameplate is 30 t/h, validated sustainable capability 28, and plan 24. A 2-hour full stop gives 48 tonnes of plan loss or 56 tonnes of sustainable-capacity loss. These views are not added together. A 32 t/h spike alone does not establish sustainable capability.

**Benchmark basis:** GE PLA distinguishes planning, demonstrated and sustained rates [S12](https://www.ge.com/digital/documentation/onpremises-apm/v513/help/pdf/Production_Loss_Analysis.pdf). The review cadence above is proposed, not an international prescribed frequency.

**Plant confirmation:** OPS/process engineering/PA: per-grade rate register, supporting run evidence, constraints, units, boundary and effective-dated approvers.

### E6. Multiple grades within one unit

**Meaning:** Identify where product identity overlaps because of parallel equipment, residence time or downstream inventory.

**Recommended answer:** Model resource, stream, lot and inventory location rather than forcing one grade on an entire aggregated unit. A reactor can have one target while downstream storage/packaging contains an earlier grade. Track transition material and mixture composition separately when applicable. Maintain total mass conservation and prevent an overlapping grade assignment from duplicating production.

**Worked example:** At 14:00 the reactor makes Grade B, a silo retains Grade A and packaging bags A. A unit-wide Grade B label would misclassify the bags. Resource/lot tracking correctly assigns B to new reactor output and A to the withdrawn silo inventory.

**Benchmark basis:** This is a physical material-tracking requirement. Concurrent grades are not limited to parallel trains; actual configuration must be supplied by the plant.

**Plant confirmation:** OPS/PA: reactors/trains, finishing lines, silo inventory model, grade/lot IDs, residence delays and mixing rules.

### E7. Calendars and measurement-source hierarchy

**Meaning:** Define when each resource is expected to produce and which evidence is authoritative for its output.

**Recommended answer:** Provide a versioned calendar by unit: site time zone, shift/day boundaries, holidays, planned outages and schedule freeze. Preserve the questionnaire's stated Saturday-Friday weekly setting as a plant configuration, not a universal rule. Store event timestamps consistently and report in plant-local time. Rank actuals sources by validated boundary and quality: typically calibrated primary totalizer, qualified redundant measurement, reconciled production/inventory record, then explicitly approved estimate. A packing total is not automatically a substitute for reactor output.

**Worked example:** A day-shift totalizer is unavailable. A redundant meter at the same boundary can be used with a substitution flag. Packaging records are only a valid fallback after accounting for silo stock changes and time lag. A forecast of 200 tonnes must never be silently used as measured actual production.

**Benchmark basis:** OPC UA provides measurement status and timestamp semantics [S2](https://reference.opcfoundation.org/specs/OPC-10000-4/7.11); source precedence and calendar configuration are plant-specific controls.

**Plant confirmation:** OPS/PA/MET/automation: source IDs, same-boundary checks, quality rules, fallback approval, time-zone/holiday calendar and effective dates.

## Sources

- **S1:** [OPC Foundation - PackML data representation model](https://reference.opcfoundation.org/specs/OPC-30050/6). Primary technical reference for PackML suspension, holding and execution; not a universal business time-bucket list.

- **S2:** [OPC Foundation - DataValue](https://reference.opcfoundation.org/specs/OPC-10000-4/7.11). Primary technical reference for value, quality/status, source timestamps and exception-based sources. No universal stale timeout is asserted.

- **S3:** [Vorne - OEE FAQ](https://www.oee.com/faq/). Practitioner guidance on line constraints and internal/external losses; not an ISO standard.

- **S4:** [Vorne - Six Big Losses](https://www.oee.com/oee-six-big-losses/). Practitioner guidance on loss categories and flexible small-stop thresholds.

- **S5:** [ISO 14224:2016 - official scope and status](https://www.iso.org/standard/64076.html). Formal petrochemical reliability/maintenance data reference. Public scope reviewed; no claim of a complete licensed clause audit.

- **S6:** [ISO/TC 67-hosted implementation paper, OTC-28705-MS (2018)](https://committee.iso.org/files/live/sites/tc67/files/news/OTC-28705-MS%20paper%20about%20ISO%20TC67%20standards%20in%20Houston%203%20May%202018.pdf). Implementation evidence on taxonomy, staged failure data and maintenance records; not a replacement for the standard.

- **S7:** [NIST - Constant repair rate (HPP/exponential) model](https://www.itl.nist.gov/div898/handbook/apr/section4/apr451.htm). Primary reliability-statistics guidance. Confidence example assumes constant failure intensity and appropriate observed exposure.

- **S8:** [U.S. GAO - The Green Book](https://www.gao.gov/greenbook). General internal-control framework used as a cross-sector comparator, not as an Iranian plant legal obligation or a source of the proposed deadlines.

- **S9:** [OSHA - 29 CFR 1910.119, particularly incident investigation paragraph (m)](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.119). US covered-process legal benchmark, including a 48-hour investigation-start limit. Used for comparison, not asserted to govern this plant.

- **S10:** [APQC - Monthly financial close, measure 104615](https://www.apqc.org/what-we-do/benchmarking/open-standards-benchmarking/measures/cycle-time-days-finance-shared). Public display: median 8.0 days; 3,389 All Companies. Broad finance measure accessed 14 October 2026; not a plant working-day deadline or sector-specific quartile.

- **S11:** [IFRS Foundation - IAS 8 overview](https://www.ifrs.org/issued-standards/list-of-standards/ias-8-basis-of-preparation-of-financial-statements/). Primary overview distinguishing accounting errors, estimates and policy changes. Operational versioning and financial posting are separate.

- **S12:** [GE - APM 5.1.3 Production Loss Analysis documentation](https://www.ge.com/digital/documentation/onpremises-apm/v513/help/pdf/Production_Loss_Analysis.pdf). Vendor reference on unaccounted loss, configurable tolerance and planning/demonstrated/sustained rates; not a universal industry mandate.

- **S13:** [NIST TN 1297 - Combined standard uncertainty](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-5-combined-standard-uncertainty). Primary measurement guidance on combining uncertainty components, including covariance.

- **S14:** [ACCA - Relevant costs](https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f5/technical-articles/relevant-costs.html). Professional-accountancy guidance on changed cash flows, spare capacity and opportunity cost; numerical loss examples in this report are original illustrations.

- **S15:** [IFRS Foundation - IAS 2 Inventories overview](https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/). Primary overview of inventory cost and write-downs; does not equate accounting cost with all economic opportunity loss.

- **S16:** [IFRS Foundation - IAS 21 overview](https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/). Primary currency-translation overview. Applicability and policy must be determined by finance.

- **S17:** [IFRS Foundation - Lack of exchangeability amendments](https://www.ifrs.org/news-and-events/news/2023/08/iasb-sets-out-accounting-requirements-for-when-currency-not-exchangeable/). Primary announcement; amendments effective for annual periods beginning on/after 1 January 2025.

- **S18:** [AASB 121 - compilation applicable from 2025 before 2027](https://standards.aasb.gov.au/aasb-121-oct-2023). Public IAS 21-equivalent reference, especially paragraphs 21-23 and 39-40, on transaction rates, closing rates and limitations of averages.

- **S19:** [FDA - MDSAP QMS P0009 corrective-action procedure](https://www.fda.gov/medical-devices/medical-device-single-audit-program-mdsap/mdsap-qms-p0009-nonconformity-and-corrective-action-procedure). Primary example of documented corrective-action effectiveness. Cross-sector comparison only.

- **S20:** [IEC 60812:2018 - FMEA and FMECA](https://webstore.iec.ch/en/publication/26359). Generic formal FMEA reference with tailoring and different prioritization methods; no universal RPN=100 cutoff.

- **S21:** [AIAG - AIAG and VDA FMEA improvements white paper](https://www.aiag.org/docs/default-source/quality-/new_aiag_vda_fmea_-whitepaper.pdf?sfvrsn=6923e9d_4). Primary automotive-method source explaining replacement of RPN with Action Priority in that handbook; exact AP lookup table is not reproduced.

- **S22:** [ASQ - Five Whys and Five Hows](https://asq.org/quality-resources/five-whys). Primary professional guidance allowing more or fewer than five questions and complementary cause-analysis tools.

- **S23:** [Gisnas, Srinivasan and Bonvin - Optimal grade transitions for polyethylene reactors (2003)](https://www.sciencedirect.com/science/article/pii/S1570794603805886). Primary research abstract, DOI 10.1016/S1570-7946(03)80588-6; supports process dependence, not a universal transition duration.

- **S24:** [Vorne - Calculating OEE](https://www.oee.com/calculating-oee/). Practitioner reference for availability/performance/first-pass quality definitions.
