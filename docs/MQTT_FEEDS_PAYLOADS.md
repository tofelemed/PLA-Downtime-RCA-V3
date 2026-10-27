# MQTT feeds: payload templates for OT (draft, 26 Oct 2026)

Traverse Forge reads two kinds of message from **one MQTT connection**, each on its own topic:

| Topic (example) | Purpose | What Traverse Forge does with it |
|---|---|---|
| `proact/marun/hdpe/pla` | **PLA**: plant production loss for one day | Creates one production loss event for the unit and day, with OT's planned, actual and shortfall |
| `proact/marun/hdpe/downtime` | **Downtime**: one stop | Opens or closes a stop on the unit / equipment in the Event Hub |

Rules for both topics:
- Send JSON objects with QoS 1.
- Times are ISO 8601 with an offset or `Z`, for example `2026-10-25T06:12:00+03:30`.
- The field names below are the **template**. If OT's names differ, an administrator remaps each field in Connectivity → the connection → Payload profile → Field mapping. Nothing has to change on the OT side.
- Fields marked *required* must be present; other fields are optional.

## PLA (production loss per unit and day)

PLA = one production loss event per unit per day. Traverse Forge shows it in the Event Hub, where people code it (reason split by tonnes). The shortfall is the event's quantity.

```json
{
  "event_type": "PRODUCTION_LOSS_DETECTED",
  "schema_version": "1.0",
  "event_id": "MARUN-HDPE-20261025",
  "event_revision": 1,
  "plant": "MARUN_HDPE",
  "production_date": "2026-10-25",
  "period_start": "2026-10-25T00:00:00+03:30",
  "period_end": "2026-10-26T00:00:00+03:30",
  "plan": { "source": "PLANNING_SYSTEM_TBD", "plan_id": "PLAN-20261025", "revision": 1, "approved": true, "planned_production_t": 240 },
  "production": { "actual_good_production_t": 208, "shortfall_t": 32, "measurement_quality": "GOOD" },
  "pi_source": { "actual_tag": "PI_TAG_TBD", "event_frame_id": "PI_EVENT_ID_TBD" },
  "status": "DETECTED"
}
```

| Field (template path) | Required | Meaning |
|---|---|---|
| `event_id` | yes | Identity of the day's loss; the event is `pla:<event_id>` |
| `event_revision` | no (1) | Send a higher revision to correct a day: it replaces the figures and keeps the coding people already gave. The same revision with other numbers goes to quarantine |
| `production_date` | yes | `YYYY-MM-DD` |
| `period_start`, `period_end` | yes | Boundaries of the production day; the event covers exactly this window |
| `production.actual_good_production_t` | yes | Actual good production in t |
| `production.shortfall_t` | yes | Shortfall in t; the event's quantity. Must be 0 or more: a negative value (overproduction) is not a loss and is quarantined |
| `plan.planned_production_t` | no | OT planned production in t |
| `status` | no (`REPORTED`) | Source status, see the status rule below |
| `plan.source`, `plan.plan_id`, `plan.revision`, `plan.approved` | no | Which plan OT measured against; kept with the event |
| `pi_source.actual_tag`, `pi_source.event_frame_id` | no | PI provenance of the actual; kept with the event |
| `production.measurement_quality`, `plant`, `event_type` | no | Kept with the event |

The unit comes from the feed setting (a PLA feed without a unit is quarantined as `mapping_invalid_target`).

**Identity rule.** Planned − actual = shortfall, within the plant's tolerance (Loss accounting settings). A day that breaks it still creates the event, with a review item for a person to resolve.

**Status rule.** `DETECTED` and `CONFIRMED` both create the event. The approval of the day needs `CONFIRMED`: send the same `event_id` again with a higher `event_revision` and `status` `CONFIRMED` when OT has confirmed the figures.

## Downtime (one stop)

Closed stop, sent in one message:

```json
{
  "event_type": "DOWNTIME",
  "schema_version": "1.0",
  "event_id": "MARUN-HDPE-EXT1-20261025-0612",
  "event_revision": 1,
  "plant": "MARUN_HDPE",
  "unit": "Extruder1",
  "equipment": "EXT1-Main",
  "start_time": "2026-10-25T06:12:00+03:30",
  "end_time": "2026-10-25T06:47:00+03:30",
  "duration_min": 35,
  "reason_code": "MECH-GEARBOX",
  "description": "Gearbox high vibration trip",
  "status": "CLOSED"
}
```

To report a stop while it is still running:
1. Send the message without `end_time` (and without `duration_min`). The stop shows as ongoing.
2. When it ends, send the same `event_id` again with `end_time` and a higher `event_revision`.

| Field (template path) | Required | Meaning |
|---|---|---|
| `event_id` | yes | Identity of the stop; the same id is the same stop |
| `event_revision` | no | Higher = newer |
| `unit` | yes, unless `equipment` is given | Traverse Forge **unit code**, e.g. `Extruder1` (not case-sensitive) |
| `equipment` | no | Traverse Forge **asset code**, e.g. `EXT1-Main` |
| `start_time` | yes | When the stop began |
| `end_time` | no | When it ended (absent / null = still running) |
| `duration_min` | no | Gives the end time when `end_time` is absent; the unit (s, min or h) is set on the feed |
| `reason_code` | no | Traverse Forge reason code or name, e.g. `MECH-GEARBOX` |
| `description` | no | Free text |
| `status`, `plant`, `event_type` | no | Kept with the stop |

## What happens with a bad or unknown message

Every such message goes to Connectivity → Quarantine, with the reason and the field named:

| Case | Quarantine item |
|---|---|
| A required field is missing, or a date / time / number cannot be read | `schema_invalid`, naming the field and its path |
| A PLA day with a missing or negative shortfall | `schema_invalid`. Overproduction is not a loss |
| A stop's unit / equipment code is not a Traverse Forge unit or asset | `unknown_unit`. Bind the code to a unit, then replay |
| A reason that is not in the code library | `unknown_code`. The stop is created uncoded and operators code it in the Event Hub |
| The same revision of a PLA day sent again with different numbers | `order_conflict`. Send the correction as a higher `event_revision` |
