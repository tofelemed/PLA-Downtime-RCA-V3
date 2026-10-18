# Equipment setup and end-to-end test: data request

Prepared against the ProAct implementation inspected **17 October 2026**. Forward this document to OT/data engineering and the named business owners. It covers one extruder from master data through MQTT, downtime, production loss, approval and analysis. Follow the [single-extruder procedure](E2E_SINGLE_EXTRUDER.md) to enter the returned data. This is a request template, not evidence of a completed live test.

## 1. How to complete and return this request

Replace **[reply]** in the last column; attach repeated records as tables/files keyed by equipment, product, signal or work-order code. Return actual raw payloads and timestamped exports, not screenshots alone. Every example here is **Demo data**, including rates, prices and FX. Do not adopt an example as an engineering or financial standard.

**R** = needed for the baseline test; **C** = needed when the stated feature applies; **O** = optional. These marks describe test needs. An application-required field is additionally called **app required**; optional app fields can still be essential for trustworthy results. Reply **N/A + reason** for conditional sections and **Unknown + owner/date to resolve** for missing data. Unknown quantities or costs must not be entered as zero.

OT supplies source/tag/broker information and coordinates the return. Production/planning owns rates, calendars and plans; maintenance owns failure/repair data; quality/metrology owns dispositions, calibration and uncertainty; finance owns money and FX. The application administrator creates app records and approvals. Send passwords and private keys through your approved secret channel; return a secret reference/contact here. Do not put credentials in this shared document.

| Handover control | Need / expected answer | Owner reply |
|---|---|---|
| Equipment and contacts | R: plant, extruder code, OT owner, publisher owner, production/planning, maintenance, quality and finance contacts | [reply] |
| Intended scope | R: downtime only, quantity PLA, OEE, financial loss, reliability/MTTR; mark optional streams, buffers, grade transitions, RCA/month close in/out | [reply] |
| Test window T0/T1 | R: agreed future start/end, plant IANA time zone, corresponding UTC timestamps; start after effective-now approvals | [reply] |
| Delivery mode | R: live observation or isolated replay; broker/environment, raw-history period, replay clock/timestamp handling and authorized test operator | [reply] |
| Delivery package | R: completed tables, tag dictionary, broker contract, raw messages/history, production log, quality evidence, stop log; C: repair and finance evidence | [reply] |
| Evidence and sign-off | R: attachment names/versions, source system, extract time, responsible owner, approved engineering definitions; proposed acceptance tolerances | [reply] |

Use stable business codes throughout. ProAct generates UUIDs, row versions, approval hashes and audit actors; OT does not supply them. The setup operator maps returned codes to the generated IDs and saves links in the handover record. Identify plant/unit/product/mode on each repeated record. For versioned records supply **effective from**, optional **effective to (exclusive)**, source/evidence and owner. Avoid overlapping effective versions. Local dates must state their calendar; raw timestamps should be RFC3339 with `Z` or an explicit offset. A window includes its start and excludes its end.

## 2. Plant, unit, assets and products — setup steps 1–4

Owner: OT + production + application administrator. Reuse existing plant and shared records where applicable. Routes: `/admin/plants/new`, `/admin?tab=settings`, `/master-data/units/new`, `/master-data/assets/new`, `/master-data/products/new`, `/master-data/hierarchy`.

| Record / on-screen fields | Need / format, allowed values and example | Owner reply |
|---|---|---|
| Plant: Organization | R, app required: existing organization name/code; administrator selects its app record | [reply] |
| Plant: Code / Name | R, app required: code ≤50, starts alphanumeric, letters/digits/`_ . -`, unique; name ≤255. Demo `HDPE-DEMO` / `HDPE Demo` | [reply] |
| Plant: Time zone / Description | R: valid IANA time zone ≤64, e.g. `Asia/Tehran`; O: description ≤2000. Time zone is entered at creation and read-only in Plant settings | [reply] |
| Plant settings: Calendar system / Digits / First day of week | R: Gregorian or Persian; Latin or Persian; Saturday or Monday. Confirm reporting preference | [reply] |
| Site / area / line / CMMS functional location | R: physical context and existing organizational hierarchy. Current master-data hierarchy is organization → plant → unit → asset; extra area/line levels are supporting context | [reply] |
| Unit: Code / Name / Description | R: code ≤50 unique in plant; name ≤255 (both app required); O: description ≤2000. Demo `Extruder1` / `HDPE Extruder 1` | [reply] |
| Unit: Unit of measure | R for quantity PLA: consistent mass unit, Demo `t`; app optional ≤50. State whether source uses kg, t, lb, volume or counts | [reply] |
| Unit: legacy Capacity / Ideal cycle time (seconds per unit) | O: nonnegative numbers if used. These legacy fields do not replace approved profile production rates | [reply] |
| Asset: Code / Name / Production unit | R: each physical asset; code ≤50 unique in plant, name ≤255, parent production-unit code (app required). Demo `EXT1-Main` | [reply] |
| Asset: Asset type / Criticality / Operating status | R engineering classification: Equipment, Instrument, Tool, Vehicle, Building, Other; High, Medium, Low; Active, Inactive, Maintenance, Offline | [reply] |
| Asset: Description / Manufacturer / Model / Serial number / Location | O: description ≤2000; other text ≤255 each; repeat for drive, gearbox, feeder, pelletizer and measurement equipment as applicable | [reply] |
| Asset equipment class / maintainable items / dependencies | C for reliability/class thresholds: class code/name, maintainable-item list, production dependencies, standby partner. No dedicated Asset class or Parent asset field in the current asset editor; class/dictionary mapping needs explicit confirmation | [reply] |
| Product: Code / Name / Unit of measure / Description | R: each test grade; code ≤50 unique in organization, name ≤255 (app required), quantity UOM ≤50; O description ≤2000. Demo `HD5502` / `HDPE HD5502` / `t` | [reply] |
| Product: Available to | R: select plant-only availability for the profile/plan workflow; identify plant. List every grade involved in the test | [reply] |
| Product: legacy Standard cost | O: nonnegative; not the authoritative profile valuation rate used for loss valuation | [reply] |
| Density / conversion / measurement basis | C for volume/count-to-mass: density, unit, reference temperature, moisture basis, mass-per-piece, conversion formula, responsible owner and evidence. No product-density editor field or implied automatic conversion: agree upstream conversion before testing | [reply] |
| Boundary definition and equipment drawing | R: where production is counted, gross vs good meaning, upstream/downstream boundaries and inventory inside them; attach P&ID/flow sketch if available. Demo `extruder_outlet` | [reply] |

There are no editable date-format, time-format or currency inputs in the inspected Plant settings form. Reporting currencies are configured in Finance. Branding is optional administration, not equipment telemetry data.

## 3. Codes, classification and production policies — steps 5–7

Owner: production + maintenance + OT. Routes: `/master-data/codes-rules`, `/master-data/stop-policy`, `/master-data/unit-impact-rules`. Return mapping tables from **actual PLC/PI/MQTT values** to the intended app classifications. Existing active plant codes may be reused.

| Record / fields | Need / format or options | Owner reply |
|---|---|---|
| Code library / Code / Name / Parent / Description | R: library `reason-codes`, `impact-codes`, `oee-codes`, `failure-code-groups`, `loss-category-defs`; unique code within library, name, parent code if hierarchical, description | [reply] |
| Reason: Category / Default OEE component | R classification: Category is text, not a loss-tree selector. OEE: Availability, Performance, Quality, Idle, Not OEE loss, or no default. Demo gearbox trip → Availability | [reply] |
| Reason: Default schedule class / Default impact code | R: planned, unplanned, external, unknown, or no default; existing active impact code. Identify planned shutdown, breakdown, starvation, blockage, grade change and uncoded/pending behavior | [reply] |
| Impact code: Category / Cost per hour (plant currency) | C: impact category and optional legacy hourly cost with currency/evidence; this does not substitute for contribution margin per tonne | [reply] |
| Loss-category definitions: Parent / Order in reports | R if using loss tree: hierarchy and integer order ≥0; separate reason-to-category mapping where required | [reply] |
| Failure-code groups: Level / Parent | C: Failure class, Problem, Cause, Remedy, with hierarchy and code/name. Distinct from the detailed reliability dictionaries below | [reply] |
| Detailed failure dictionary: List / Equipment class / Asset types / Code / Name / Pending/unknown choice | C: lists `equipment_class`, `maintainable_item`, `failure_mode`, `failure_mechanism`, `failure_cause`, `detection_method`; code ≤50/name ≤255. Equipment-class restriction for item/mode, blank = every class; equipment-class asset-type list separated by `;` (≤50 entries, ≤50 each); pending/unknown flag | [reply] |
| Automatic rules: Name / Kind / Priority / Description / Conditions / Actions | C: desired truth table, source fields, comparisons/thresholds, condition groups, priority (lower first), reason/impact/OEE/schedule outputs and examples. Kind/operators/action fields are schema-driven in the editor; confirm supported schema before implementing the rule | [reply] |
| Stop policy: Applies to / Derive stops from unit state | R: unit or whole plant; derivation on/off. Demo unit `Extruder1`, enabled | [reply] |
| Stop policy: Auto-merge unique cross-source duplicates | R: yes/no and which event streams overlap. Avoid producing two independent records for the same physical stop in the baseline | [reply] |
| Stop debounce / Restart confirmation / Duplicate tolerance / Incident window | R: integer seconds 0–86400 each; agreed engineering timings, not guessed defaults. Include expected treatment of chatter, brief restarts and adjacent events | [reply] |
| Micro-stop threshold / Asset-class overrides / Trip reason codes / Notes | R: threshold seconds 0–86400, trip codes overriding micro-stop treatment; C: class→threshold rows; O notes ≤1000. Include examples just below/at/above thresholds | [reply] |
| Grade-change plan allowance | R: **Plans already allow for standard grade changes** (`planned`) or **Count allowance against plan** (`loss`), with planning rationale. Policy changes take effect now | [reply] |
| Asset impact: Unit / Asset / Impact / Fraction | C: `full_stop`, `fractional`, `none`; fractional output loss >0–100%; unit/asset codes | [reply] |
| Asset impact: Standby asset / Takeover window / Why / Effective dates | C: standby partner different from failed asset, takeover seconds 0–86400 (default60), required rationale, effective interval; propose and approve rule | [reply] |

## 4. Calendar, crews and engineering production rates — steps 8–9

Owner: production/planning, with engineering confirmation of rates. Routes: `/planning/calendars/new`, `/planning?tab=calendars`, `/planning/profiles/new` and saved profile detail.

| Record / fields | Need / format or options | Owner reply |
|---|---|---|
| Calendar: Scope / Time zone / Operational day starts / Effective from / Effective to | R: plant/site or unit, IANA zone, local `HH:mm`, operational start date; O exclusive end date. Demo unit calendar, `Asia/Tehran`, `06:00` | [reply] |
| Shift pattern: Name / Start (local) / End (local) / Weekdays | R repeated rows: name, `HH:mm` start/end, weekdays1–7 Monday=1, empty = every day. End ≤ start crosses midnight; equal =24h. Demo A06–14/B14–22/C22–06; no overlaps/gaps for continuous operation | [reply] |
| Holidays: Date / Name / Treatment / Working windows | C: date/name; No production (excluded) or Reduced hours (reduced); reduced day requires local start/end working-window rows | [reply] |
| Exclusions: Start / End / Reason / Kind | C: planned shutdown, turnaround or no demand; exact dates/times and reason. Agree whether exclusion changes scheduled time or is an in-schedule planned stop | [reply] |
| Crew: Name / Site context | C: one row per crew, existing site if applicable | [reply] |
| Rotation: Crew / Cycle / Cycle day 1 / Effective from | C: repeating shift names, `-` for off, anchor date and start date. Crews label shifts; they do not create production capacity. Rotation end is not exposed by this editor | [reply] |
| Profile: Unit / Product / Operating mode / Quantity unit | R, app required: equipment/product codes, mode1–64 letters/digits/`_ . -` (Demo `normal`), mass UOM (Demo `t`) | [reply] |
| Profile: Rate timebase / Capacity model / Effective from / Effective to | R: `s`, `min`, `h`, `d`; Single stream, Shared capacity, Independent streams; required start, optional exclusive end. Demo Single stream, `h` | [reply] |
| Production rate: Kind / Rate / Timebase / Effective interval | R repeated approved **sustained** and **planning** rates covering full test. Other kinds nameplate, demonstrated, budget, forecast conditional. Decimal ≤16 integer/8 fractional digits; usable sustained/planning >0. Demo both28t/h | [reply] |
| Rate provenance / constraints | R: test/design document, engineering owner, product/mode, derating conditions and quantity basis. Explain differences between nameplate, demonstrated, sustained and planning values | [reply] |
| Multi-product/multi-mode coverage | C: repeat profiles and rates for each grade/mode active during test; provide campaign/changeover boundaries | [reply] |

Publish the calendar; approve the profile **and each separate rate version**. A saved profile with an unapproved/missing sustained rate is insufficient for capacity/OEE; a missing planning rate prevents a meaningful plan baseline.

## 5. MQTT transport and publisher contract — step 10

Owner: OT/data engineering + network/security. ProAct subscribes; the PLC/PI-to-MQTT publisher and broker are external. Route `/connectivity/connections/new`, then the saved connection's profile editor. Return actual values, agreed units and an example for every family of message.

| Wizard / fields | Need / format or options | OT reply |
|---|---|---|
| Profile: Payload profile kind | R: `measurement_json`, `state_json`, `interval_event_json`, `availability`. One saved connection has one profile; use separate connections for incompatible families | [reply] |
| Profile: Topic template / Identity strategy | R: exact topic segments with `{unit}` or `{machine}` equipment capture; `seq_boot`, `event_id` or `payload_hash`. Provide mapping to actual production-unit code | [reply] |
| Basics: Name / Broker URL | R: identifiable name; `mqtt://host[:port]` or `mqtts://host[:port]`, port1–65535, no URL path. Return DNS/IP, port, environment and responsible broker contact | [reply] |
| Basics: Topics / Availability topic | R:1–64 distinct subscription filters, wildcard use and actual resolved example topics; C: availability topic. Topic namespace must match template depth | [reply] |
| Connection: Protocol version / Client ID | R: MQTT5 or3.1.1; optional client ID1–64 letters/digits/`_ -`, blank generates `proact-UUID`. Confirm uniqueness, ACL allowlist and session persistence | [reply] |
| Connection: Username / Password | C broker auth: username ≤256; password delivered separately; reply secret reference/contact and account permissions, not password | [reply] |
| TLS: Trust mode | R: System trust, CA PEM, CA reference, or insecure development mode. Insecure mode is not accepted in production. State server certificate chain and expiry owner | [reply] |
| TLS: CA certificate / CA reference / Server name (SNI) | C: CA PEM ≤65536 characters or `secrets:UUID` reference; SNI ≤253 where exposed for custom trust. Never attach private keys. Dedicated client-certificate/private-key fields are absent: flag any mandatory mTLS requirement for integration review | [reply] |
| Advanced: QoS / Clean start / Session expiry | R: QoS0/1/2 (default1), clean-start bool(defaultfalse), expiry0–4294967295s(default86400). Confirm publisher QoS and broker retention/offline queue behavior | [reply] |
| Advanced: Keep alive / Connection timeout / Reconnect minimum and maximum | R: keepalive1–65535s(default60), timeout1–300s(default30), reconnect1–3600s(default1/60, max≥min) | [reply] |
| Advanced: Maximum message size | R:1–1048576bytes(default65536); actual largest payload and broker limit | [reply] |
| Profile: Schema version / Time unit / Maximum future skew / Maximum age / Stale policy | R: version(Demo `1.0`); `auto`, `ms`, `s`, `iso`; nonnegative skew/age seconds(default300/604800); `reject` or `flag`. Confirm observation time, clock synchronization and permitted replay window | [reply] |
| Profile: Quality protocol | R: `undeclared`, `STRING_ENUM`, `OPC_DA`, `OPC_UA`, `SPARKPLUG`, `PI`, `NONE`; return raw quality values, semantics and intended good/uncertain/bad/unknown behavior | [reply] |
| Profile field paths: common | R: actual JSON paths for event time, sequence, boot ID, source, quality; C site/tenant. Demo `ts`, `seq`, `boot_id`, `source`, `quality`, `site`, `tenant`. Paths are edited on saved connection | [reply] |
| Measurement paths: Signal / Value / Unit | C measurement profile: Demo `signal`, `value`, `uom`; scalar/object value examples, data type and digital name/value semantics | [reply] |
| State paths: State / Previous state | C native state profile: Demo `state`, `previous`; provide raw state object/scalar and full topic | [reply] |
| Event paths: Event ID / Revision / Operation / Template / Element path | C interval-event profile: Demo `event_id`, `revision`, `operation`, `template`, `element_path`; stable IDs, monotonically revised corrections and upsert/delete behavior | [reply] |
| Event paths: Start time / End time / Attributes / Attribute units / Reason attribute | C: Demo `start_ts`, `end_ts`, `attributes`, `attribute_units`; null end for open event; Reason path(default `Reason Code`) and exact names/units for impact, OEE, description, quantity and severity attributes in use | [reply] |
| Availability paths: State / PI connected | C: Demo `state`, `pi_connected`; online/offline vocabulary and its communication-health meaning | [reply] |
| Value maps: State / Reason / Unmapped reason behavior | C: actual-token→normalized-token rows; unmapped reason `reject` or `keep`; confirm all raw digital codes/names | [reply] |
| Network and access context | R supporting information: ProAct-to-broker route, DNS, firewall/source-IP rules, certificates, ACL topic permissions, broker limits/HA and outage contact. These are deployment inputs, not all wizard fields | [reply] |
| Delivery/identity contract | R: sequence scope, boot-ID lifecycle, duplicates, retained flag policy, corrections, late/out-of-order delivery and reconnect replay. `seq_boot` identity uses equipment+boot+sequence: sequence must be unique across all signals on that equipment/boot | [reply] |
| Source-of-truth location / publisher logic | R: PLC/PI tag path, PI AF/EF template if used, calculation/aggregation/exception compression rules, publisher service/version and owner | [reply] |

## 6. Signal dictionary, physical states and output authority — steps 11–13

Owner: OT + engineering + production accounting. Routes: saved connection → Signals → **Define signal**, `/master-data/unit-state`, `/connectivity/source-authority`; optional `/connectivity/source-status`.

| Record / fields | Need / format or options | Owner reply |
|---|---|---|
| Signal: Name / Production unit / Source stream ID | R each signal: name ≤255, unit, source key ≤1000 (app required). For `measurement_json`, source key equals payload `signal`; for `state_json`, it equals full state topic | [reply] |
| Signal: Source path / Kind | R kind: rate, counter, state, quality, level, output increments or other; O path ≤2000 for PLC/PI provenance. Include actual payload type | [reply] |
| Signal: Canonical unit of measure / Rate timebase | R output: incoming UOM ≤32, counter quantity e.g. `t`, rate e.g. `t/h` with matching `s/min/h/d` timebase; integrated quantity must match profile or agreed conversion; a counter delta is a quantity, not t/h. Demo counter `t` | [reply] |
| Signal: Between samples / Maximum gap | R: `step` or `linear`, gap1–604800s(default900), with physical justification. Do not interpolate across an unmeasured outage as if measured | [reply] |
| Signal: Reset policy / Rollover modulus | C counters: `none`, `known_instant`, `detect_drop`; modulus if rollover, reset schedule/trigger and examples immediately before/after reset. Confirm behavior against actual publisher | [reply] |
| Signal: Expected minimum / Expected maximum | C: signed decimal limits (≤16 integer/8 fractional digits), with calibration/range evidence; not inferred from sample extrema | [reply] |
| Signal: Sample interval / Effective from / Accept uncertain / Is authority | R cadence1–86400s, effective start covering test, uncertain quality accept yes/no(defaultno), authority flag. Authority flag alone does not select MQTT as primary output | [reply] |
| Repeated source-tag detail | R supporting dictionary: instrument/tag ID, description, signal family, raw UOM, canonical UOM, measurement boundary, gross/good/reject meaning, calibration resolution, deadband, normal cadence and stop cadence, data owner | [reply] |
| Unit-state: Unit / State signal / Rules | R exact values mapped to `running`, `reduced_rate`, `internal_stop`, `planned_stop`, `starved`, `blocked`, `standby`, `not_scheduled`; repeat source Signal value→State rows. Demo RUN→running, STOP→internal_stop | [reply] |
| Unit-state: Expected interval / Jitter / Stale after intervals / Heartbeat source | R: interval1–86400s, jitter0–86400s, stale intervals1–100, heartbeat bool. State whether publisher repeats static RUN/STOP and unchanged counters | [reply] |
| Unit-state: Effective from / Notes | R start covering test (blank uses now); O notes ≤1000 | [reply] |
| Analog state: Enable / Stopped below / Reduced below / Hysteresis / Rated value / Stop state | C analog mapping: finite stop threshold, reduced threshold above stop, hysteresis≥0, rated value>0 if supplied; stop state internal_stop/starved/blocked. Supply engineering units and hysteresis examples | [reply] |
| Source priority: Applies to / Measurement boundary | R: plant or unit, boundary1–64 letters/digits/`_ . -`; Demo unit/extruder_outlet. MQTT must be explicitly approved before measurement window | [reply] |
| Source priority: Replacement conditions | R chosen subset: Missing(`primary_missing`), Stale(`primary_stale`), Incomplete/bad quality(`primary_bad_quality`), Conflict(`primary_conflict`); agree evidence/fallback criteria | [reply] |
| Source priority: Ranked entries | R:1–10 rows, Rank, Source class, Source, Signal(optional), Boundary. Source classes: Calibrated primary totalizer(`calibrated_primary`), Redundant measurement(`redundant_measurement`), Reconciled production / inventory record(`reconciled_record`), Approved estimate (manual)(`approved_estimate`). Source choices `pi_counter`, `pi_output_ef`, `pi_rate`, `mqtt`, `kafka`, `manual`, `external_report`; include engineering calibration rationale | [reply] |
| Source priority: Cross-boundary adjustment / Notes | C: different boundary requires Inventory change accounted, Lag seconds≥0, Evidence reference≤500; O notes≤2000. Provide inventory balance/transport delay, not an unsupported cross-boundary comparison | [reply] |
| Source-status mapping: Source system / Status / Released / Effective from / Notes | C external actual reports: status→released yes/no rows, start and notes. Proposed mappings require approval before report statuses are trusted | [reply] |

Request at least a **physical-state signal and measured gross-output counter/rate/increment stream**. A reject/quality signal, authoritative lot records or accepted dispositions are additionally needed for quality/OEE. State alone cannot establish actual tonnes. Counter samples must cover boundaries and changes; sparse screenshots are insufficient.

## 7. Financial valuation — step 14

Owner: finance/treasury + production accounting, coordinated by OT. Routes `/finance` and profile valuation rates. Conditional for a downtime/quantity-only pilot; required before claiming validated financial losses. Finance must confirm every value and policy; do not ask OT to estimate margins.

| Record / fields | Need / format or options | Finance reply |
|---|---|---|
| Policy: Default management view / Time-based costs | C: contribution_margin, standard_cost, economic_impact; exclusive or independent_components; latter needs Independent impact codes | [reply] |
| Policy: Reporting currencies / FX policy / Starts / Notes | C: choose IRR and/or USD (1–2); none or snapshot; effective instant required; notes≤2000 | [reply] |
| Policy: FX table / FX date / Average FX maximum deviation | C: economic, group_reporting, budget; event_date or period_average; optional deviation ratio0–1(max6decimals), e.g.0.05 | [reply] |
| Policy: Lost-sales rule / Quality disposition map / Default quality disposition / Manual line hours | C economic view: demand_constrained_only, all_lost_output, none(disables economic view); impact-code→scrap/downgrade/rework, default or none(unvalued); hourly charge bool | [reply] |
| Profile valuation rate: Basis / Value / Per unit / Currency / Effective interval | C repeated: contribution_margin, standard_cost, variable_cost, salvage_value, disposal_cost, downgrade_price_difference, rework_cost, rework_yield; value≥0; UOM and currencyIRR/USD. Yield dimensionless0–1. Demo margin150USD/t only | [reply] |
| Hourly impact costs | C if used: impact-code-owned cost_per_hour rate, currency, effective interval and evidence; distinguish independent charges from quantity-loss valuation to avoid double counting | [reply] |
| FX: Table / From currency / To currency / Rate / Valid from / Valid until | C: currencies different, positive rate≤14integer/10fractionaldigits, complete time coverage and explicit direction. Demo600000IRR per1USD is fictional | [reply] |
| FX: Provisional / Source | C: provisional bool requires Valid until; source≤255, approved treasury evidence/reference | [reply] |
| Demand status: Product / Status / Evidence / Effective interval | C demand-constrained valuation: demand_constrained or not_constrained, required evidence and applicable dates | [reply] |

For the simple contribution-margin example, money = valued lost quantity × approved margin per quantity unit × applicable FX. Economic/quality/hourly views use their own policy components; a missing input must remain unvalued. See E2E §17 for implemented calculations and limitations.

## 8. Plan and production/quality/maintenance evidence — steps 15–18

Owner: production/planning + quality + maintenance. Routes `/planning/plans/new`, `/events/new`, `/events/:id`, `/plans/:planId/periods/:periodId` and its disposition/adjustment panels. Return source logs for the same boundaries, product, mode and interval as telemetry.

| Record / fields | Need / format or options | Owner reply |
|---|---|---|
| Plan: Name / Unit / Scenario / Window start / Window end / Change reason | R: approved planning scenario/accounting baseline, exact half-open window and rationale. Administrator resolves scenario/unit IDs | [reply] |
| Plan: Basis / Header target / Distribution | R: time, quantity or manual; target as required by chosen basis; scheduled_capacity, explicit_weights or equal. Confirm quantity UOM. Demo daily672t/shift224t | [reply] |
| Plan product slices: Product / Weight / Slice target / Campaign start and end | R: grades; C weight for explicit_weights, slice target instead of header target; optional campaigns default whole window, current editor uses sequential campaigns | [reply] |
| Manual targets: Product slice / Shift start / Shift target | C manual basis: exact published shift-start timestamp and target for each shift; omitted shifts receive zero | [reply] |
| Production confirmation | R: shift/day product/mode, campaign/lot, opening/closing counter, gross/good/reject/rework quantities with UOM, start/end, source and signed production log; identify mass transfers/inventory | [reply] |
| Event: Unit / Type / Start / End / Duration (minutes) | R known stop/output/quality cases: Downtime, Slowdown, Quality loss, Production output, Advisory; required start, optional end(open event); duration≥0 must agree with end | [reply] |
| Event coding: Reason code / Schedule class / Description | R ground truth reason code, planned/unplanned/external/unknown or default; active leaf reason where coding; description/comment≤4000. Explain uncoded/pending cases | [reply] |
| Event impact: Impact / Output lost % / Approved planned end / Caused by unit / Asset | C: full/fractional/no impact, partial loss>0–100%, planned-end evidence, causal unit and asset codes | [reply] |
| Failure details: Severity / Maintainable item / Failure mode / Mechanism / Cause / Detection method | C failure events: pending, critical, degraded, incipient; dictionary choices or supported text (mode≤255, mechanism/cause/detection≤100). There is no single generic Failure code field | [reply] |
| Manual production output: Quantity / Unit | C absent automated output or explicit manual-source test: measured quantity≥0, UOM≤32, evidence. Prevent double counting with authoritative automated stream | [reply] |
| Manual slowdown: Measured quantity or Loss % | C: mutually exclusive alternatives, time window/UOM and evidence; do not enter both | [reply] |
| Manual quality event: Quantity / Unit / Disposition | C: quantity, UOM, unknown/downgrade/scrap/rework; does not replace approved lot-disposition evidence needed for reconciled quality | [reply] |
| Lot disposition: Product / Lot number / Disposition / Quantity / Unit | R for quality test: lot≤64; wide_spec_good, downgrade, transition_offgrade, scrap, rework; quantity>0 and UOM. Demo2t offgrade from192t gross | [reply] |
| Lot disposition: Produced from/to / Lab released / Evidence / Note | R production interval, lab/QA record; C lab release instant; note and traceable evidence reference. Distinguish production from later release time | [reply] |
| Rework recovery: Recovery / Recovery of / Recovery quantity / Remeasured / Target lots | C: prior rework lot/record, recovered quantity, measurement confirmation and destination lot links/evidence. Do not count recovered material twice | [reply] |
| Actuals adjustment: Product slice / Kind / Quantity / Basis / Reason / Evidence / Window from/to | C corrections only: signed **nonzero** quantity, kind gross/good/reject/rework; basis measured/estimated, reason/evidence required; window both ends or neither, end>start; trace original and corrected quantities | [reply] |
| Manual loss line: Loss kind / Quantity / Event links or No event / Reason / Category / Evidence type/reference / Comment | C: supported loss type, measured justification, linked source events, evidence reference≤200; unresolved missing reason code blocks relevant workflow | [reply] |
| Repair operations: Work order ID / Operation ID / Kind / Started at / Ended at | C **required for MTTR**: order≤100, operation≤50; diagnosis/repair/test/other; actual start, optional end if ongoing. Diagnosis/repair/test count as active repair | [reply] |
| Repair operations: Waiting seconds/reason / Asset / Stop link / Description / Source | C: waiting seconds≥0, reason≤100; asset code≤50 or mapped ID; stop association; description≤2000, source≤50. Provide real active repair intervals, not WO creation/administrative closure | [reply] |
| Reliability history and exposure | C for meaningful trends: complete observation interval, running hours, qualifying failures, restored/open/censored incidents, severity, failure linkage, duplicates and asset class. A single failure supports a fixture check, not a population reliability conclusion | [reply] |

Code and verify received events, validate required failure details, approve dispositions/adjustments, reconcile both ledgers and save loss decisions before submission. SuperAdmin can perform every role, including their own approvals; explicit workflow actions and evidence are still required. Ordinary roles retain independence rules. The `/approvals` inbox shows state and required approval role; confirmed approved/retired items leave the pending list. Complex items open their decision workspace.

## 9. Conditional engineering data

Mark each feature in/out. These records are not required for the single-stream baseline; include them when the physical setup or acceptance scope needs them. Owner: process engineering + quality/metrology + maintenance. Use the relevant Master Data and Measurement uncertainty pages linked by the equipment guide.

| Feature / fields | Need / expected data | Owner reply |
|---|---|---|
| Concurrent streams: Unit / Code / Name / Capacity share / Notes / Effective dates | C shared/independent streams: stream code1–64, capacity share and physical meaning, profile capacity model; confirm feature availability and supported accounting model | [reply] |
| Stream run: Unit / Stream / Product / Lot / Start / End / Notes | C: stream/product codes, lot≤64, precise actual run intervals and simultaneous-operation evidence | [reply] |
| Flow route: From unit / To unit / Role / Yield factor / Buffer / Usable inventory / Operating limits / Inventory UOM / Draw rate / Notes / Effective dates | C upstream/downstream attribution: actual route, role from current editor, material yield, buffer capacity/usable quantity/minimum/maximum level, draw quantity per hour, transport delay and evidence | [reply] |
| Buffer observation: Route / Observed at / Level / UOM / Source / Notes | C: timestamped inventory/level measurements, calibrated conversion to usable mass and boundary agreement | [reply] |
| Standby readiness/demand evidence | C: primary/standby assets, availability/evaluation interval, standby-from timestamp, demand/start/success/failure timestamps and takeover production evidence | [reply] |
| Grade transition standard: Unit / From product / To product / Catalyst family / Operating mode / Reference duration / Reference offgrade / UOM / Sample count / Evidence / Notes / Effective dates | C: different from/to grades, optional family/mode≤64; editor duration **hours**>0(APIseconds), offgrade quantity, sample count≥1 and approved history | [reply] |
| Uncertainty budget: Boundary / UOM / Components / Correlations / Coverage factor | C metrology/reconciliation: component kind meter/scale/inventory/conversion/timing, label, standard uncertainty and units, sensitivity(default1); component-pair correlation[-1,1], coverage factor(default2) | [reply] |
| Uncertainty budget: Calibration reference / Review due / Effective from / Evidence / Notes | C: calibration reference, due date and start required; certificate and calculation. Distinguish standard from expanded uncertainty. Approval and adoption as tolerance are separate decisions | [reply] |
| Month close / RCA extensions | C if explicitly in scope: named owners, accounting calendar, materiality/bridge thresholds, posting dates, finance/review evidence and investigation/action/effectiveness records. Coordinate their separate workflows after the shift baseline | [reply] |

## 10. Raw payloads and history to attach

For each connection provide its profile, subscription/template, source keys, sample JSON, raw quality and time interpretation. Example below uses `measurement_json`, PI quality and **globally increasing equipment sequence**. Demo T0 is18October2026 06:00Asia/Tehran =02:30UTC; agree a later T0 if necessary and move every associated date together.

```json
{"schema_version":"1.0","signal":"EXT1-State","value":{"name":"RUN","value":1},"ts":"2026-10-18T02:30:00Z","quality":{"good":true,"questionable":false,"substituted":false},"seq":1,"boot_id":"gw-01-boot-1","source":"pi-mqtt-gw-01"}
```
```json
{"schema_version":"1.0","signal":"EXT1-Throughput","value":1000,"uom":"t","ts":"2026-10-18T02:30:00Z","quality":{"good":true,"questionable":false,"substituted":false},"seq":2,"boot_id":"gw-01-boot-1","source":"pi-mqtt-gw-01"}
```

Here signal Source stream IDs are `EXT1-State` and `EXT1-Throughput`. Agree actual topics/template with OT; the topic is not their source key. Supply both RUN and STOP plus all other real values. PI `good=false` is bad; questionable/substituted data is uncertain; absent quality is unknown under that declared protocol. Agree acceptance policy explicitly.

**Alternative native `state_json`** is supported on a connection configured with that profile. Supply `state`, optional `previous`, `ts`, identity/source and declared quality fields. Its state signal Source stream ID is the **full MQTT topic**. Do not mix its binding rule with `measurement_json`. Full state decoder examples are in E2E §15.

**Optional interval-event source:** supply open, update, close and delete examples with stable `event_id`, increasing `revision`, `operation`, template/element path, start/end, actual attributes and attribute units, observation time and identity. Describe what revises/retracts an existing event. Decide whether this or derived state owns each stop to avoid duplicate physical losses. Availability online/offline messages represent communication health, not machine RUN/STOP.

Attach a full test interval plus opening/boundary and closing samples, preferably a complete production day with all shifts. Supply state/counter cadence **while stopped as well as running**, exact change/boundary readings, raw quality, retained metadata, sequence/boot IDs and receive timestamps where available. Minute samples plus transition/boundary readings suit the Demo baseline; OT must confirm realistic cadence. Exception-only feeds need deliberate heartbeat/coverage settings. A flat counter is valid zero production only when coverage/quality demonstrate it was measured.

## 11. Controlled scenarios and expected truth

Agree safe live observation or use an authorized isolated publisher/replay. Do not deliberately stop operating equipment for this document. Complete effective-now source/policy approvals before T0; arbitrary historical replay can be stale, duplicate or outside approved coverage. Preserve original data and record any timestamp remapping.

| Scenario | Ground truth / records to return | Owner reply |
|---|---|---|
| Normal run | Stable RUN, counter/rate with known quantity, product/mode, exact shift-boundary values, no quality losses if genuinely measured | [reply] |
| Internal breakdown | STOP/restored timestamps, asset/reason, schedule/severity, actual production zero, failure validation; repair operations if testing MTTR | [reply] |
| Brief stop / chatter / trip | Below/at/above micro threshold and debounce/restart windows; a short trip with configured trip reason; expected merged/separate incident count | [reply] |
| Slowdown | RUN/reduced-rate intervals, actual gross below sustained capacity, measured output and causal evidence. Do not infer every low rate is a validated failure | [reply] |
| Planned stop / exclusion / grade transition | Approved plan/calendar treatment, allowance and actual timestamps; transition offgrade and standard if applicable | [reply] |
| Starved / blocked / standby | Physical states, upstream/downstream cause, route/buffer/takeover data when attribution is in scope | [reply] |
| Quality | Lot/time/grade, measured offgrade/scrap/rework, approved QA evidence, quantity basis; recovery/downgrade economics if in scope | [reply] |
| Communication outage / bad quality | Publisher/broker outage, stale heartbeat, missing/bad/uncertain samples and expected unknown intervals; never label loss of communication as confirmed machine downtime | [reply] |
| Duplicates / order / resets | Duplicate delivery, late/out-of-order sample, reboot/sequence reset, counter reset/rollover and corrected event; expected single accounting result/quarantine outcome | [reply] |
| Source fallback / boundary mismatch | Primary missing/stale/bad/conflicting and permitted fallback, exact overlapping measurements/inventory/lag evidence; confirm authority effective interval | [reply] |
| Time and coverage boundaries | Overnight shift, operational day, holiday/reduced hours, open stop crossing shift boundary, effective-date changes and late quality release | [reply] |
| Workflow and analysis | Pending state/required role, approve/retire disappearance, approved period/day, common unit/date/ledger filters and traceable source-to-analysis result | [reply] |

Optional reproducible **Demo** check (E2E §18):8h shift, 28t/h sustained/planning, 1h eligible breakdown, 192t gross, 2t approved offgrade, 190t good. Counter1000→1056 in first2h, flat during1h stop, then27.2t/h for5h→1192; transmit complete intermediate/boundary samples, not only these checkpoints. Expected capacity224t; availability/performance/quality losses28/4/2t; total34t; A87.5%, P97.9592%, Q98.9583%, OEE84.8214%. Plan gap34t needs supported loss decisions to explain its residual. With Demo margin150USD/t and DemoFX600000IRR/USD, simple margin loss5100USD/3060000000IRR. One eligible failure gives fixture MTBF7h;1h outage is **not MTTR** without active-repair evidence. Use current formulas in E2E §17 for other scenarios, including micro-stops and overlapping incidents.

## 12. Return acceptance and setup handover

1. Owners confirm codes, units, boundary, time zone, mapping meanings and evidence; no mandatory unknown remains hidden as zero. Resolve class, conversion, mTLS or unsupported-source gaps before promising full coverage.
2. Administrator enters records in guide order, publishes calendar and completes applicable approvals. One authenticated **SuperAdmin can author and decide every role** without a second person; valid states, evidence and explicit decisions remain mandatory. Keep generated record/approval links alongside returned business codes.
3. Select the unit/product/mode and actual window in **Administration → Equipment Setup Guide → Automatic readiness checks**. Resolve missing records/approvals and measured state/output coverage; navigation completion or broker connectivity alone is insufficient.
4. Inspect samples, quarantine and derived previews, then compare received quantities/state transitions with the supplied ground truth. Quality must have independent evidence; check authoritative-source selection and no duplicated events/output.
5. Generate/approve plan periods, code/verify events, approve quality evidence and corrections, recompute both ledgers, explain residuals with evidence, submit/approve shifts and certify the day when all shifts/gates are ready. Check the pending inbox after decisions.
6. Compare period ledgers/KPIs and provenance to `/downtime` and `/pla-analytics` with identical unit, product, dates, scope and ledger. Reconcile capacity losses, plan gap, residuals and money separately; record coverage/uncertainty limitations and approved tolerances rather than forcing a balance.
7. Return result links/exports, expected vs actual totals, unresolved exceptions with owner and date, and production/OT/quality/finance acceptance. Live authenticated UI behavior and the physical broker-to-approved-ledger scenario must be verified in that run; source inspection does not prove them.

## 13. Implementation references

These are field/behavior sources, not OT deliverables. Extra context rows above are deliberately identified where no dedicated form field exists. Schema-driven rule options should be checked on the deployed form; actual external broker/publisher behavior remains unverified until OT returns its contract and samples.

- [Full entry procedure, formulas, buttons and workflow](E2E_SINGLE_EXTRUDER.md); [equipment guide/readiness](../src/features/equipment-setup/).
- [Plant create](../src/features/admin/plants/hierarchy-form-page.tsx), [plant DTO](../server/pro-act-backend/src/v2/administration/hierarchy/hierarchy-v2.dto.ts), [settings](../src/features/settings/).
- [Unit](../src/features/master-data/units/unit-form.tsx), [asset](../src/features/master-data/assets/asset-form.tsx), [product](../src/features/master-data/products/product-form.tsx), [hierarchy](../src/features/master-data/hierarchy/hierarchy-page.tsx).
- [Codes/rules](../src/features/codes-admin/), [failure dictionary](../src/features/master-data/reliability/dictionary-entry-form.tsx), [stop policy](../src/features/master-data/reliability/policy/), [impact rules](../src/features/master-data/reliability/impact-rules/).
- [Calendar/profile/plan forms](../src/features/plans-profiles-calendars/), [profile/rate DTOs](../server/pro-act-backend/src/v2/profiles/).
- [MQTT wizard/profiles](../src/features/integration-console/mqtt/), [decoders](../server/pro-act-backend/src/intake/adapters/mqtt/profiles/), [signal form](../src/features/integration-console/signals/signal-form-fields.tsx), [signal DTO](../server/pro-act-backend/src/v2/signals/signal-v2.dto.ts).
- [Unit-state mapping](../src/features/master-data/reliability/unit-state/), [source authority](../src/features/integration-console/source-authority/), [source-status mapping](../src/features/integration-console/status-mappings/).
- [Finance](../src/features/finance/), [valuation DTOs](../server/pro-act-backend/src/v2/valuation/), [event fields](../src/features/event-hub/), [period/quality/adjustments](../src/features/plan-dashboard/).
- [Work-order operation contract](../server/pro-act-backend/src/v2/reliability/work-order-operations-v2.dto.ts), [uncertainty form](../src/features/measurement-uncertainty/model/budget-form.ts), [KPI domain](../server/pro-act-backend/src/domain/kpi/), [accounting domain](../server/pro-act-backend/src/domain/accounting/).
- [Pending approvals](../src/features/approvals/), [role model](../server/pro-act-backend/src/auth/roles/role-model.ts). The older [MQTT OT contract](MQTT_OT_CONTRACT.md) is supplementary; current forms/decoders and the single-extruder guide govern implemented behavior.
