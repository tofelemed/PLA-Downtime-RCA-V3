"""Author the spec §19 acceptance fixtures T01–T46 as JSON (Phase 0.1 step 7).

Numerical fixtures carry `inputs` and `expected` (quantities as decimal strings, ACC09 epsilon 1e-6).
Scenario fixtures carry Given / action / assert text and become executable tests in their owning sub-phase.
Usage: python scripts/evidence/author-fixtures.py
"""
import json
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "server", "pro-act-backend", "test", "fixtures")
EPS = "0.000001"


def num(fid, title, ref, inputs, expected, owner, notes=""):
    return dict(id=fid, title=title, kind="numerical", spec_ref=ref, tolerance=EPS, inputs=inputs,
                expected=expected, owner_subphase=owner, notes=notes, status="authored")


def scn(fid, title, ref, given, action, assertion, owner):
    return dict(id=fid, title=title, kind="scenario", spec_ref=ref, given=given, action=action,
                assertion=assertion, owner_subphase=owner, status="authored")


NUMERICAL = [
    num("T01", "Interval duration", "§19.1 T01, §3.3",
        {"startTime": "2026-10-07T06:00:00Z", "endTime": "2026-10-07T07:30:00Z"},
        {"durationSeconds": "5400", "displayMinutes": "90", "displayHours": "1.5", "sameValueEverywhere": True}, "1.1"),
    num("T02", "Open event with source sentinel", "§19.1 T02, PI03",
        {"startTime": "2026-10-07T10:00:00Z", "sourceEndTime": "9999-12-31T23:59:59Z", "asOf": "2026-10-07T10:15:00Z"},
        {"endTime": None, "durationSeconds": None, "elapsedSeconds": "900", "neverYear9999Duration": True,
         "rawSentinelRetained": True}, "1.1"),
    num("T03", "Overlapping asset stops on one unit", "§19.1 T03, DT05, DT07",
        {"unitId": "U1", "events": [
            {"id": "E1", "assetId": "A1", "start": "2026-10-07T10:00:00Z", "end": "2026-10-07T11:00:00Z"},
            {"id": "E2", "assetId": "A2", "start": "2026-10-07T10:30:00Z", "end": "2026-10-07T11:30:00Z"}]},
        {"unitDowntimeSeconds": "5400", "rawEventCount": 2, "assetDowntimeSeconds": {"A1": "3600", "A2": "3600"},
         "assetTotalsAdditiveToUnit": False, "primaryCauseAllocationTotalSeconds": "5400",
         "sharesPerSegmentSumTo": "1"}, "1.1"),
    num("T15", "Plan reconciliation with unexplained residual", "§19.1 T15, ACC01, ACC10",
        {"ledger": "plan", "targetQty": "1000", "actualQty": "850", "acceptedLines": ["90", "40", "10"],
         "tolerancePolicy": {"mode": "zero"}},
        {"gap": "150", "attributed": "140", "residual": "10", "residualLabel": "unaccounted",
         "submitResult": "422 RESIDUAL_UNEXPLAINED"}, "2.5"),
    num("T16", "Over-accounting", "§19.1 T16, ACC01, ACC10",
        {"ledger": "plan", "targetQty": "1000", "actualQty": "850", "acceptedLines": ["160"],
         "tolerancePolicy": {"mode": "zero"}},
        {"gap": "150", "attributed": "160", "residual": "-10", "overAccounted": "10", "approvalBlocked": True}, "2.5"),
    num("T17", "Above-plan output with attributed loss", "§19.1 T17, ACC01",
        {"ledger": "plan", "targetQty": "1000", "actualQty": "1050", "acceptedLines": ["20"]},
        {"gap": "-50", "overproduction": "50", "attributed": "20", "residual": "-70",
         "attributedPlanLossConflictFlag": True, "physicalLossReportedAsDowntime": False}, "2.5"),
    num("T20", "Operational OEE", "§19.1 T20, KPI01",
        {"scheduledSeconds": "28800", "availabilityStopSeconds": "3600", "idealRatePerMinute": "2",
         "grossQty": "756", "goodQty": "718.2", "quantityUom": "units"},
        {"runTimeSeconds": "25200", "availability": "0.875", "performance": "0.9", "quality": "0.95",
         "oee": "0.748125", "availabilityLossQty": "120", "performanceLossQty": "84", "qualityLossQty": "37.8",
         "goodPlusLossesEqualsCapacity": "960"}, "2.7",
        "Ideal time for gross = 756/2 = 378 min = 22680 s; P = 22680/25200 = 0.9. Full-schedule capacity 480 min x 2 = 960."),
    num("T21", "GE-compatible reconciled OEE", "§19.1 T21, KPI04",
        {"goodQty": "850", "availabilityLossQty": "100", "performanceLossQty": "30", "qualityLossQty": "20"},
        {"availability": "0.9", "performance": "0.9666666667", "quality": "0.9770114943", "oee": "0.85",
         "label": "Reconciled PLA OEE"}, "2.7"),
    num("T25", "Rate integration", "§19.1 T25, ACT04, PI09",
        {"signal": {"semanticType": "rate", "uom": "t", "timebase": "h", "interpolation": "step"},
         "samples": [{"t": "2026-10-07T08:00:00Z", "v": "120", "q": "good"},
                     {"t": "2026-10-07T08:30:00Z", "v": "120", "q": "good"}],
         "window": {"from": "2026-10-07T08:00:00Z", "to": "2026-10-07T08:30:00Z"}},
        {"quantity": "60", "uom": "t", "method": "rate_integration/step", "timebaseConversionRecorded": True,
         "coverageRatio": "1"}, "1.7"),
    num("T26", "Counter rollover", "§19.1 T26, ACT03, PI09",
        {"signal": {"semanticType": "counter", "rolloverModulus": "1000", "expectedMaxRatePerHour": "500"},
         "readings": [{"t": "2026-10-07T08:00:00Z", "v": "995"}, {"t": "2026-10-07T08:06:00Z", "v": "5"}]},
        {"delta": "10", "impliedRatePerHour": "100", "accepted": True, "rejectIfImpliedRateExceeds": "500"}, "1.7"),
    num("T27", "Counter reset with unknown reset time", "§19.1 T27, ACT03",
        {"signal": {"semanticType": "counter", "rolloverModulus": None, "resetPolicy": "detect_drop"},
         "readings": [{"t": "2026-10-07T08:00:00Z", "v": "1000"}, {"t": "2026-10-07T09:00:00Z", "v": "10"}],
         "intermediateReadings": []},
        {"quantity": None, "qualityState": "incomplete", "exception": "reset_unresolved",
         "forbiddenValues": ["990", "1010"], "approvalBlocked": True}, "1.7"),
    num("T28", "Capacity ledger versus plan ledger", "§19.1 T28, ACC01, ACC02, ACC04",
        {"calendarHours": "8", "sustainedRatePerHour": "100", "excludedHours": "1", "planningRatePerHour": "90",
         "planTargetQty": "630", "scheduledStopHours": "1", "grossQty": "570", "goodQty": "550"},
        {"capacity": {"capacityQty": "800", "scheduleExclusion": "100", "availabilityLoss": "100",
                      "performanceLoss": "30", "qualityLoss": "20", "goodQty": "550", "residual": "0"},
         "plan": {"targetQty": "630", "actualQty": "550", "gap": "80", "planningRateStopCandidate": "90",
                  "candidateExceedsGap": True, "flag": "bridge_or_conflict", "forcedAllocation": False}}, "2.5"),
    num("T29", "Cross-shift clipping", "§19.1 T29, DT05, KPI06",
        {"stop": {"startLocal": "05:50", "endLocal": "06:20", "tz": "Asia/Dubai"}, "shiftBoundaryLocal": "06:00"},
        {"priorShiftSeconds": "600", "nextShiftSeconds": "1200", "occurrenceCount": 1}, "1.1"),
    num("T30", "Rate version change during a stop", "§19.1 T30, ACC02",
        {"stopSegments": [{"minutes": "30", "sustainedRatePerHour": "100", "rateVersion": "v1"},
                          {"minutes": "30", "sustainedRatePerHour": "120", "rateVersion": "v2"}]},
        {"capacityLossQty": "110", "lines": 2, "rateVersionsUsed": ["v1", "v2"]}, "2.5"),
    num("T31", "Weighted aggregation of OEE", "§19.1 T31, AN03",
        {"periods": [{"goodIdealSeconds": "5400", "scheduledSeconds": "6000"},
                     {"goodIdealSeconds": "27000", "scheduledSeconds": "54000"}]},
        {"combinedOee": "0.54", "meanOfPercentagesForbidden": "0.7", "numerator": "32400", "denominator": "60000"},
        "2.7"),
    num("T32", "Tolerance adjustment", "§19.1 T32, ACC09",
        {"targetQty": "1000", "residual": "0.5", "tolerancePolicy": {"mode": "percent", "value": "0.1"}},
        {"toleranceQty": "1", "residualDisplayed": "0.5",
         "acceptedAdjustmentLine": {"kind": "tolerance_adjustment", "quantity": "0.5"}, "silentZero": False}, "2.8"),
]

SCENARIOS = [
    ("T04", "Source refresh preserves user work", "§19.2 T04, ING06",
     "User codes an event and links RCA", "PI updates the event frame end time",
     "Source revision changes; user coding, status and RCA link survive", "1.2"),
    ("T05", "Typed mapping", "§19.2 T05, ING04",
     "Digital-state object attribute, TimeSpan duration string, asset-only binding", "Map the event frame",
     "Digital Name/Value preserved; valid duration with diagnostic; unitId derived from asset", "1.3"),
    ("T06", "Mapping replay", "§19.2 T06, ING05",
     "Unknown path quarantined", "Correct mapping, replay run twice",
     "One canonical event; raw lineage and resolution retained", "1.5"),
    ("T07", "PI paging", "§19.2 T07, PI04",
     "1201 frames, page size 500, failure on page 3", "Run window extraction",
     "No completed window checkpoint until durable capture; retry yields 1201 unique source objects", "1.6"),
    ("T08", "Long open frame", "§19.2 T08, PI03",
     "Frame start predates lookback; closes today", "Open-frame refresh job runs",
     "Closure found; impacted drafts recalculate", "1.6"),
    ("T09", "MQTT replay", "§19.2 T09, MQ02, MQ05",
     "Disconnect/reconnect, duplicate QoS 1 delivery, retained old state", "Reconnect subscriber",
     "One business observation effect; no new stop at reconnect", "1.8"),
    ("T10", "Kafka crash", "§19.2 T10, KF02",
     "Consumer crashes after DB commit before offset commit", "Restart and rebalance",
     "One ledger effect from inbox uniqueness; no missing accepted records", "1.9"),
    ("T11", "Source outage", "§19.2 T11, DT04, MQ04",
     "Broker, historian or collector loses contact", "Staleness boundary passes",
     "Source health unavailable; state becomes Unknown per policy, not Stopped", "1.10"),
    ("T12", "Competing actuals", "§19.2 T12, SRC01",
     "PI and MQTT report the same output window", "Compute actuals",
     "One selected authority; conflict visible; output not doubled", "1.10"),
    ("T13", "Compound queries", "§19.2 T13, API01",
     "Events across tenants, units and reasons", "Query tenant + unit + asset + reason + overlapping time",
     "All filters apply; pagination stable; no unrelated events", "0.4"),
    ("T14", "Tenant attack", "§19.2 T14, WF05",
     "Foreign tenant IDs in routes, joins, replay, export, socket and cache", "Attempt access as tenant B",
     "Access denied with no existence/data leakage; audit identifies attempt", "0.4"),
    ("T18", "Reason hierarchy", "§19.2 T18",
     "Reason tree saved", "Reload, version mappings, retire parent",
     "Hierarchy persists; cycles rejected; historical mapping unchanged", "1.3"),
    ("T19", "DST calendar", "§19.2 T19, CAL02",
     "Daily schedules on 23-hour and 25-hour local days", "Generate shift instances",
     "Correct UTC elapsed durations, repeated-hour offsets and quantities", "2.1"),
    ("T22", "Rule persistence", "§19.2 T22, NFR02",
     "Declarative status rule saved", "Restart backend, replay fixture",
     "Same result; no function serialization or arbitrary code execution", "3.8"),
    ("T23", "Realtime scope", "§19.2 T23, API05",
     "Clients in tenant A and B connected", "Event changed in tenant A",
     "Only authorized A clients receive one invalidation; reconnect refetches", "1.9/3.1"),
    ("T24", "Reporting UI consistency", "§19.2 T24, AN01, AN02",
     "Analytics page open", "Change groupBy, scope, date and ledger then drill down",
     "Chart, totals and export use the same result version and filters", "3.6/3.3"),
    ("T33", "Atomic save", "§19.2 T33, ACC08",
     "Draft with lines", "Force failure midway through reconciliation update",
     "No partial replacement or deleted lines; previous revision intact", "2.8"),
    ("T34", "Approval race", "§19.2 T34, WF02",
     "Period submitted", "Source revision arrives between submit and approve",
     "Approval rejected as stale; recalculation and resubmission required", "2.8"),
    ("T35", "Post-approval correction", "§19.2 T35, WF04",
     "Approved period", "Late PI correction affects it",
     "Original snapshot immutable; change proposal and new draft only", "2.8"),
    ("T36", "Separation of duties", "§19.2 T36, WF02",
     "Submitter identity", "Submitter attempts approval via UI and API",
     "Both denied; distinct authorized approver succeeds", "2.8"),
    ("T37", "Event operations", "§19.2 T37, DT09",
     "Stop with linked loss lines", "Split then merge",
     "Occurrence count stable; lineage preserved; allocation conserved", "1.4"),
    ("T38", "Missing price", "§19.2 T38, VAL03",
     "Valid loss quantity, no effective margin", "Value the line",
     "Quantity remains; cost null with unvalued status, not zero", "2.6"),
    ("T39", "Export and restore", "§19.2 T39, NFR07",
     "Approved and exported period", "Restore backup, replay outbox",
     "Same approved totals and hash; downstream idempotent delivery", "2.9/3.12"),
    ("T40", "Performance soak", "§19.2 T40, §17.1",
     "Target load and 15-minute burst", "Restart a worker mid-run",
     "Meets p95 objectives; no accepted-record loss or tenant leakage", "3.11"),
    ("T41", "No-data OEE", "§19.2 T41, KPI03",
     "Zero scheduled time or missing quality evidence", "Compute OEE",
     "Null with reason; no fabricated 87 percent or default 100 percent quality", "2.7"),
    ("T42", "Non-impact alert", "§19.2 T42, §3.2",
     "IOW/APM alert without impact evidence", "Ingest alert",
     "Visible advisory; zero automatic production-loss attribution", "1.1/3.9"),
    ("T43", "Concurrent products", "§19.2 T43, PLAN05",
     "Shared-capacity recipe and two product slices", "Generate plan periods",
     "Feasible rate constraint enforced; unlike quantities and shared time not double-counted", "2.3"),
    ("T44", "Manual actuals separation", "§19.2 T44, ACT06",
     "Daily production approved", "Revise PLA reason",
     "Actuals revision unchanged; only loss explanation revision progresses", "2.4/2.8"),
    ("T45", "Multi-currency", "§19.2 T45, VAL03",
     "Losses in two currencies, no FX snapshot", "Aggregate",
     "Separate totals; combined monetary total unavailable", "2.6"),
    ("T46", "Historical deletion", "§19.2 T46, PI06, ING01",
     "Source retracts a frame referenced by approval", "Inventory comparison confirms deletion",
     "Source tombstone and proposal; no approved history deletion", "1.6"),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    fixtures = NUMERICAL + [scn(*s) for s in SCENARIOS]
    fixtures.sort(key=lambda f: int(f["id"][1:]))
    for f in fixtures:
        with open(os.path.join(OUT, f["id"] + ".json"), "w", encoding="utf-8") as fh:
            json.dump(f, fh, indent=2, ensure_ascii=False)
    index = {"version": 1, "source": "PLA_Next_Generation_Development_Specification.docx section 19",
             "epsilon": EPS, "fixtures": [f["id"] for f in fixtures]}
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, indent=2)
    print(f"fixtures written: {len(fixtures)} (numerical {len(NUMERICAL)}, scenario {len(SCENARIOS)}) -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
