# Questions for the plant SME: all remaining phases

**Pro-Act production loss accounting, 13 October 2026**

Thank you for the answers to the loss-accounting questions (Q1–Q18); they are built into the system. This
document has the questions for every remaining step, in the order we will work on them:

- **Part A: Downtime and reliability.** How stops are recorded, counted and turned into KPIs such as
  availability, MTBF and MTTR.
- **Part B: Reconciliation workflow.** How each shift's or day's production figures are checked, explained,
  approved and closed.
- **Part C: Valuation.** How lost production is turned into money (IRR and USD).
- **Part D: Root-cause analysis and corrective actions (RCA / CAPA).** When an investigation starts, how it
  is done, and how we prove the fix worked.
- **Part E: Plant data still needed** from the earlier loss-accounting questions.

## How to answer

- Each question explains what we need to decide and why it matters, then gives the **usual industry
  practice** in one line.
- Writing **"Standard"** is a valid answer: it means "do it as the usual practice says".
- If your plant works differently, describe how, ideally with a real example (unit, date, tonnes, minutes).
- If a question belongs to someone else (maintenance, quality lab, finance), write their role next to it.
- **Owner key:** OPS = operations, MNT = maintenance / reliability, PA = production accounting / planning,
  MET = metrology / quality lab, FIN = finance.

---

## Part A: Downtime and reliability

Your answer to **D16 (the week starts on Saturday in Iran)** is already in place. Weekly reports for
Iranian plants run Saturday to Friday. The remaining questions are below.

### A1. Machine states and time

**D1. Which states should each unit be in at any moment?** *(OPS)*
Today a unit is either "running" or "stopped". Plants usually also tell apart:
- idle with no order;
- waiting for material from upstream (starved);
- unable to discharge because downstream is full (blocked);
- on standby;
- no signal at all.

Which of these should we track separately? Does the list differ by unit type (reactor, extruder,
bagging, utilities)?
> **Usual practice:** ISA-95 / PackML give each state its own time bucket, and time without data is never
> counted as running.

**Answer:**

**D2. When the signal from a unit is lost, after how long should that time count as "unknown"?** *(OPS, MET)*
If the PLC or PI historian stops sending data, we do not know whether the unit ran or stopped.
- Should a short gap be filled in, and after how many seconds or minutes should it become "unknown time"
  that someone has to explain?
- Should unknown time lower availability until it is explained?
> **Usual practice:** a gap longer than about 2–3 times the normal reporting interval is "unknown". It is
> left out of availability and MTBF until it is explained.

**Answer:**

**D3. A unit stops because the unit before it cannot feed it, or the unit after it cannot take product. Whose loss is it?** *(OPS)*
For example, the extruder stops because the reactor tripped. Does the extruder's lost time count
against the extruder, the reactor, or both? Should the extruder's report show it as an internal or an
external cause?
> **Usual practice:** it counts against the stopped unit's availability, but the cause is the upstream or
> downstream unit and it is reported in a separate category (ISO 22400).

**Answer:**

**D4. Planned maintenance runs longer than planned. Is the extra time planned or unplanned?** *(OPS, MNT)*
For example, an 8-hour shutdown is planned but takes 11 hours. Are the extra 3 hours planned downtime
or a breakdown?
> **Usual practice:** the time beyond the planned window is unplanned downtime.

**Answer:**

### A2. Stop rules

**D5. When a unit restarts and stops again shortly after for the same reason, is that one stop or two?** *(OPS)*
For example, a conveyor trips, restarts, and trips again 2 minutes later for the same reason. Counting
this as several stops makes the stop count look high and MTBF look low. Within how many minutes should
repeat stops with the same cause be merged into one?

The system already lists stops on the same equipment that overlap in time ("possible duplicates", for
example the same trip entered by hand and by PI). This question is about the merge rule.
> **Usual practice:** yes, merge them when they fall within a window of about 2–5 minutes with the same
> cause.

**Answer:**

**D6. How short does a stop have to be to count as a "micro-stop"?** *(OPS)*
Very short stops are usually treated as a speed loss (performance) rather than downtime
(availability). Today the system uses one threshold everywhere. Should it differ per line or unit, and
what are the values?
> **Usual practice:** 2–5 minutes, set from the line's cycle time. Micro-stops reduce performance, not
> availability.

**Answer:**

**D7. When two stops overlap on the same unit, which one carries the lost time?** *(OPS)*
For example, a motor trips at 10:00, and at 10:05 a feed chute blocks while the motor is still down. The
system can do either of these; which should be the default?
- give all the overlapping time to the stop that started first ("first-out");
- split it equally between the two.
> **Usual practice:** first-out. The stop that started first carries the loss, because the later stops
> are usually its consequences.

**Answer:**

### A3. Reliability measures (MTBF, MTTR)

**D8. Which stops count as "failures" when we calculate MTBF?** *(MNT)*
Should MTBF count only equipment breakdowns, or every unplanned stop? Unplanned stops also include:
- operational stops (grade change, operator error);
- external stops (power cut, no raw material).
> **Usual practice:** ISO 14224 counts only equipment failures (critical or degraded). Operational,
> external and planned stops are not failures.

**Answer:**

**D9. What time should MTBF be measured over?** *(MNT)*
The options are calendar time, scheduled production time, or the hours the equipment actually ran. For
standby equipment, such as a spare pump that runs only when the main one fails, does its idle time
count?
> **Usual practice:** actual operating time. A standby unit accrues exposure only while it is in service or
> required to be available (ISO 14224).

**Answer:**

**D10. When does repair time (MTTR) start and stop, and where does the evidence come from?** *(MNT)*
- Repair time could start when the unit stopped, when maintenance was called, or when work actually
  began.
- It could end when the repair finished or when production resumed.
- Do you have a CMMS (for example SAP PM or Maximo) with work-order start and finish times that we can
  use?
> **Usual practice:** MTTR is active repair time; total downtime is tracked separately as MDT (EN 15341 /
> ISO 14224). The evidence is the work order's start and finish times.

**Answer:**

**D11. Should we organise failure reasons using the ISO 14224 structure?** *(MNT)*
That structure has four levels:
1. equipment type;
2. failure mode: what happened, e.g. "fails to start";
3. mechanism: how, e.g. "wear";
4. cause: why, e.g. "lubrication".

Do your current reason codes follow something like this, or should we map them to it together?
> **Usual practice:** yes, ISO 14224 Annex B lists the standard failure modes for each equipment class.

**Answer:**

### A4. Coding and reporting

**D12. How detailed must the downtime reason be, and by when must it be entered?** *(OPS)*
For example: category (mechanical) → area (extruder drive) → reason (gearbox bearing). How many levels
are mandatory, and must every stop be coded before the shift ends?
> **Usual practice:** 3–4 levels. Coding is required within the shift, with a target of at least 95% of
> downtime coded.

**Answer:**

**D13. Who enters the reason, who checks it, and when can it no longer change?** *(OPS)*
For example:
1. The operator enters it.
2. The shift supervisor confirms it.
3. It locks when the period's production figures are approved.

Is that how your plant works?

We also need two related decisions:
- **Bulk coding.** When many stops are coded together at the end of a shift, must the person always write
  a "why" text, or is the reason code enough?
- **Coding many stops at once.** Should someone be able to code every stop that matches a filter in one
  action, or only the stops shown on the screen?
> **Usual practice:** the operator codes, the supervisor confirms, and coding locks at period approval with
> every change recorded.

**Answer:**

**D14. In the "top losses" (Pareto) chart, how should the causes be ranked?** *(OPS, PA)*
The options are total hours stopped, number of stops, tonnes lost, or money lost. Should it count all
calendar time or only the time the unit was scheduled to run? The system can show all of these; we need
the default for reports.
> **Usual practice:** tonnes or value lost, counted only within scheduled time.

**Answer:**

**D15. Causes outside the plant's control: shown inside or outside the availability figure?** *(OPS, PA)*
Examples are a grid power cut, no feedstock from the supplier, or no market demand. Your earlier answer
(Q12) was that external stops inside the schedule still lower availability, and the system now also
shows "External downtime" as its own figure. Please confirm this is right for every report, or name the
reports that should leave external time out.
> **Usual practice:** report them in a separate "external" bucket; they are excluded from OEE but included
> in TEEP.

**Answer:**

**D17. What size of loss should automatically open a root-cause analysis (RCA)?** *(OPS, MNT)*
For example: one stop longer than X hours, more than Y tonnes lost, more than Z in value (IRR / USD), or
the same failure repeating N times within M days. Should the limits be stricter for critical equipment?
> **Usual practice:** one large event (by hours, tonnes or value) or 3 repeats in 30 days, with lower
> thresholds for critical assets.

**Answer:**

### A5. Useful for a working session on downtime

- One real week of stop data, to set the merge window (D5) and the micro-stop limits (D6) together.
- Your current list of reason codes, to map onto ISO 14224 (D8, D11).
- A CMMS work-order export, to check repair times (D10).
- A list of critical equipment, with installed spares and standby units, for MTBF (D9) and RCA limits
  (D17).

---

## Part B: Reconciliation workflow

**Reconciliation** is the check that closes each period, a shift or a day. The planned production minus the
actual production must be fully explained by recorded losses (stops, slow running, off-spec), any
remainder must be named, and a second person must approve the result.

Already in place, so no question is needed:
- The approver must be someone other than the person who submitted it or wrote any of its lines.
- Manual balancing lines need a written reason.
- Approval is blocked while a loss claim is bigger than the measurements support (your Q3 answer).

### B1. Roles, deadlines and closing

**R1. Who prepares and who approves each period, and is there a second approval at month end?** *(OPS, PA, FIN)*
Today one person prepares the period's explanation and a manager approves it. Do you also need a monthly
sign-off by the plant manager or finance? Should the approver depend on the size of the loss?
> **Usual practice:** "maker–checker" for every period (one prepares, another approves) plus a monthly
> sign-off by plant management or finance.

**Answer:**

**R2. Should we reconcile per shift, per day, or both?** *(OPS, PA)*
Operations often look at shifts; accounting and finance usually close per day and per month. Which period
must be reconciled and approved?
> **Usual practice:** reconcile daily (shift detail inside it), close financially per month.

**Answer:**

**R3. By when must a period be reconciled and approved, and what happens when it is late?** *(OPS, PA)*
Today "overdue" is only a report filter (48 hours by default); there is no reminder or escalation.
- What is the deadline, for example "the day is approved by 12:00 the next day"?
- When it is missed, who is reminded, and who does it go to next?
> **Usual practice:** daily close within 24–48 hours; overdue periods escalate to the next management
> level automatically.

**Answer:**

**R4. Is there a monthly "hard close" after which approved figures are locked?** *(PA, FIN)*
After the month is closed, should a correction still be possible, and how? On which working day of the
next month does the close happen?
> **Usual practice:** the month locks on working day 3–5. Later corrections are made only as an approved
> restatement, and the original approved figures stay visible.

**Answer:**

**R5. A correction arrives after a period was approved. What should happen?** *(PA, MET)*
Examples: a late lab result, a corrected meter reading, a stop entered a day late. Your Q7 answer covered
changed master data (rates, calendars). This question is about late **production data**. Should the
system:
- (a) reopen the period for re-approval;
- (b) create a new "restated" version that needs approval, with the original kept;
- (c) book the correction into the current period instead?
> **Usual practice:** (b): restate the original period through an approved new version; reports can show
> "as approved" and "restated" side by side.

**Answer:**

**R6. If an approval is rejected, what is required and who gets it back?** *(OPS)*
Today a rejection needs a written reason and returns the period to draft. Should it go back to a named
person? Should repeated rejections (for example a third time) be escalated?
> **Usual practice:** returned to the preparer with a mandatory reason; repeated rejections escalate.

**Answer:**

### B2. Unexplained losses and balancing lines

**R7. May an unexplained remainder be approved as "unaccounted", and with which categories?** *(PA)*
Sometimes part of the shortfall cannot be tied to any recorded cause. Which do you want?
- must every tonne be explained before approval, or
- may the remainder be approved as "unaccounted" with a category (for example measurement, unknown,
  recording gap) and a reason?

Is there a limit or target, such as "unaccounted must stay below 2% of the plan"?
> **Usual practice:** allowed with a category and a reason, tracked as a KPI with a target (often below
> 2–5% of total loss) so it is driven down over time.

**Answer:**

**R8. Manual "bridge" lines that close the gap: allowed, by whom, and how large?** *(PA)*
A bridge line is a manual entry that closes the remaining gap when no cause can be found. Who may enter
one? Is there a maximum, either in tonnes or as a % of the plan? Does it always need a second approver?
> **Usual practice:** only with a written reason and an approver, limited in size, and reported separately
> so it is never confused with an explained loss.

**Answer:**

**R9. When the recorded losses add up to more than the actual shortfall, may someone enter a negative balancing line?** *(PA)*
"Over-explained" means more tonnes are claimed as lost than were actually missing. Should the person:
- correct the claims, or
- may a negative line balance it?

If a negative line is allowed, may it make room for other claims?
> **Usual practice:** no netting. Over-accounting is resolved by correcting the claims, not offset by a
> negative line.

**Answer:**

**R10. Can one event's loss be counted in more than one period or line?** *(PA)*
A long stop that runs across two shifts is split between them. Should the system always stop the total
claimed for one event from being larger than that event's own loss?
> **Usual practice:** an event's loss can be split across periods, but the total split never exceeds the
> event's loss (conservation).

**Answer:**

**R11. What evidence must a manual loss line have?** *(PA, OPS)*
For example a link to the event, a logbook entry, a lab sample number, a work order, or a photo. Which of
these are mandatory, and for which kinds of loss?
> **Usual practice:** every manual line has a reason code, a written reason and a reference to its source
> evidence.

**Answer:**

### B3. Reporting

**R12. Should official reports show only approved figures, or also provisional (not yet approved) ones?** *(PA, FIN)*
Today reports can show approved figures only, or the current draft marked as "provisional". Which should
be the default for management and monthly reports?
> **Usual practice:** management and monthly reports use approved figures; operational dashboards may
> show provisional figures, clearly labelled.

**Answer:**

**R13. Which daily production report statuses count as final?** *(PA, MET)*
When daily production figures come from an external system (for example a production or LIMS report),
which statuses mean "final"? Today the system treats `COMPLETED` and `RELEASED` as final.
> **Usual practice:** only final, released records from the system of record count as certified actuals.

**Answer:**

---

## Part C: Valuation

The system turns lost tonnes into money in IRR and USD. It shows several value "views", which are never
added together:
- contribution margin (the profit the lost product would have made);
- standard cost;
- cost per hour of downtime.

**V1. Who approves valuation policies, prices and exchange rates?** *(FIN, PA)*
Today a production manager approves them. Your earlier answer (D08) named finance as the owner. Should we
add a separate finance role that alone can approve prices, margins and exchange rates? Should the
production manager keep only read access?
> **Usual practice:** finance owns and approves prices, costs and exchange rates; operations use them but
> do not change them.

**Answer:**

**V2. How should a quality loss be valued?** *(FIN, MET)*
Today every lost tonne is valued at the contribution margin. A scrapped tonne also wastes the raw
material and energy already spent on it, and a downgraded (wide-spec) tonne still sells, at a lower
price. Which value applies to each?
- **Scrap:** margin, or margin plus material cost?
- **Downgraded product:** the price difference only?
- **Rework / recycle:** the reprocessing cost?
> **Usual practice:** scrap = lost margin + material and conversion cost already spent; downgrade = price
> difference; rework = reprocessing cost.

**Answer:**

**V3. Is every lost tonne a lost sale?** *(FIN, OPS)*
When the market could have taken all the product ("sold out"), a lost tonne is a lost margin. When
demand was lower than capacity, a lost tonne may have cost nothing extra. Should each period or product
carry a "sold out" or "demand-limited" flag? Should a demand-limited loss be valued at cost (or zero)
instead of margin?
> **Usual practice:** value at margin only when the product is sold out; when demand-limited, value at the
> variable cost saved or show the loss without a margin.

**Answer:**

**V4. Should manual loss lines also get a cost-per-hour value?** *(FIN)*
Downtime events can be valued by cost per hour (labour, fixed costs while stopped). Manual lines entered
during reconciliation cannot today. Should they?
> **Usual practice:** the same valuation rules apply to every loss line, whether it came from an event or
> was entered by hand.

**Answer:**

**V5. Which IRR exchange rate should be used?** *(FIN)*
In Iran there is more than one USD/IRR rate, for example the official rate, the NIMA rate and the
market rate. Which one is used for:
- internal reporting;
- reporting to head office?

Should the system keep more than one rate type side by side?
> **Usual practice:** one approved rate type per reporting purpose, named and dated; never mixed in one
> figure.

**Answer:**

**V6. Which date's exchange rate applies to a loss?** *(FIN)*
- the rate on the day of the loss;
- the average rate of the month;
- the rate at month-end.
> **Usual practice:** the rate of the transaction date for daily reports and the period-average rate for
> monthly totals, chosen once in the finance policy.

**Answer:**

**V7. An exchange rate is approved late. Should already-approved periods be revalued?** *(FIN, PA)*
For example, the October rate is approved on 5 November, after some October days were approved.
Should those days be recalculated, with the original values kept as "as approved"?
> **Usual practice:** periods valued without a rate show "not valued" until the rate is approved, then they
> are valued; approved periods are restated only through an approved restatement.

**Answer:**

**V8. Which value view should management reports show first?** *(FIN, OPS)*
The options are contribution margin, standard cost, or cost per hour of downtime. All three stay
available; this is the default.
> **Usual practice:** contribution margin (the commercial opportunity) for management; standard cost for
> accounting.

**Answer:**

---

## Part D: Root-cause analysis and corrective actions (RCA / CAPA)

Already in place: a case cannot be closed until the root cause is written and every action is finished.
A new case is not opened for a repeat failure while one is already open for the same asset.

**CA1. Who must approve closing an RCA case?** *(OPS, MNT)*
Today the investigator can close the case once the root cause is written and the actions are finished.
Should a second person (for example the reliability or production manager) approve the close? Should
that person have to be someone other than the investigator?
> **Usual practice:** closing needs an approver independent of the investigator, after the actions are
> verified as effective.

**Answer:**

**CA2. How do we prove that the corrective actions worked?** *(MNT, OPS)*
After the actions are done, the system watches whether the failure comes back. We need four decisions:
- **Watch period:** how long should it watch, for example 30, 60 or 90 days?
- **Result:** what counts as "effective": no repeat at all, fewer repeats than before, or a better MTBF?
- **Running time:** should the result take into account how long the unit actually ran, so a unit that
  was mostly shut down does not look "fixed"?
- **Planned stops:** should planned stops be left out?
> **Usual practice:** verify over a fixed window (often 90 days) against a baseline from the same length of
> run time before the fix; planned stops excluded; the result is recorded as "effective" or "not effective".

**Answer:**

**CA3. Where does the "before" figure (the baseline) come from?** *(MNT)*
Today the investigator types the baseline. Should the system calculate it from the recorded events, for
example the failures in the 90 days before the case, with the investigator able only to comment?
> **Usual practice:** the baseline is calculated from recorded data for a fixed period before the event.

**Answer:**

**CA4. What evidence must a finished action have?** *(MNT)*
Today an action can be marked "done" without evidence. Should a work-order number, a photo, a document or
a sign-off be required?
> **Usual practice:** every completed action carries objective evidence, such as a work order, inspection
> record or document.

**Answer:**

**CA5. Which risk-scoring method should FMEA use?** *(MNT, MET)*
The system scores each failure by severity × occurrence × detection (RPN). Today a score above 100 needs
action, a missing score is silently counted as 5, and detection is scored per effect, not per cause.
Should we:
- keep RPN with a threshold (which value?), or
- switch to the AIAG-VDA "Action Priority" table (high / medium / low)?

In both cases, should detection be scored per cause, and should a missing score block the analysis
instead of counting as 5?
> **Usual practice:** current automotive and process practice uses AIAG-VDA Action Priority; detection is
> scored per cause; an incomplete FMEA is not accepted.

**Answer:**

**CA6. Is a minimum number of "whys" a rule or a guideline?** *(OPS)*
The 5-Why tool asks for at least a set number of levels, but only the screen checks it. Should the
server refuse a 5-Why analysis with fewer levels, or is it only advice?
> **Usual practice:** a guideline; the analysis stops when an actionable root cause is reached, and the
> reviewer judges the depth.

**Answer:**

**CA7. Which methods must be used for which size of event?** *(OPS, MNT)*
For example:
- a small event: 5-Why only;
- a large event: fishbone plus 5-Why;
- a major or safety event: full team RCA with a fault tree.

Should the system require a method based on the size of the loss?
> **Usual practice:** a tiered approach: the method and team size grow with the consequence of the event.

**Answer:**

**CA8. Repeat failures, cost and "bad actor" triggers.** *(MNT)*
Your answer to D17 sets the sizes that open an RCA. Three related choices:
- Should repeats be counted per failure mode (for example "seal leak on pump P-101"), not just per asset?
- Should a cost trigger (above an amount in IRR or USD) open an RCA?
- Should an asset that is among the top losses over a period (a "bad actor") open an RCA even without one
  big event?
> **Usual practice:** repeats per failure mode; cost and bad-actor triggers alongside the event-size
> triggers.

**Answer:**

**CA9. Should lessons learned be shared between plants?** *(OPS)*
Closed cases go into a knowledge base that suggests similar past cases. Should other plants of the
organisation see your cases? Should a case count as a good example only when its actions were verified
as effective?
> **Usual practice:** lessons are shared organisation-wide; only verified-effective cases are promoted as
> good practice.

**Answer:**

---

## Part E: Plant data still needed from the loss-accounting questions

These follow from your earlier answers; they need plant values rather than a yes/no.

| # | From | What we need |
|---|---|---|
| E1 | Q9, Q10 | **Grade transitions:** the standard transition time per grade pair (from → to), and how ramp-up after a trip should be recorded per unit. |
| E2 | Q13 | **Plant flow:** which unit feeds which, and the buffers or silos between them, so a trip's consequence can be traced across units. |
| E3 | Q14 | **Quality boundaries:** where "good" is measured, how wide-spec, off-grade, recycle and rework are counted, and the price difference for downgraded product. |
| E4 | Q15 | **Tolerances:** a justified reconciliation tolerance per unit or meter, based on measurement uncertainty (the default stays zero until then). |
| E5 | Q16 | **Rates:** the approved planned rate and the sustainable maximum rate per unit and grade, with who reviews them and how often. |
| E6 | Q17 | **Multiple grades in one unit:** which units can hold several grades at once (silos, packaging, residence time), so grades can be tracked by resource or lot later. |
| E7 | (general) | Production calendars per unit, and the measurement source order per unit (which meter or system is used first, second, …). |

---

*Thank you. Please return this document with the answers filled in. "Standard" is fine wherever the usual
practice suits your plant.*
