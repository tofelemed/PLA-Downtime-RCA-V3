# MQTT feeds: payload templates for OT (draft, 26 Oct 2026)

Traverse Forge reads two kinds of message from **one MQTT connection**, each on its own topic:

| Topic (example) | Purpose | What Traverse Forge does with it |
|---|---|---|
| `proact/marun/hdpe/pla` | **PLA**: plant production for one day | Stores a daily production report: the OT actual, plus OT's planned and shortfall for comparison |
| `proact/marun/hdpe/downtime` | **Downtime**: one stop | Opens or closes a stop on the unit / equipment in the Event Hub |

Rules for both topics:
- Send JSON objects with QoS 1.
- Times are ISO 8601 with an offset or `Z`, for example `2026-10-25T06:12:00+03:30`.
- The field names below are the **template**. If OT's names differ, an administrator remaps each field in Connectivity → the connection → Payload profile → Field mapping. Nothing has to change on the OT side.
- Fields marked *required* must be present; other fields are optional.

## PLA (plant production per day)

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
| `event_id` | yes | Identity of the day's report |
| `event_revision` | no (1) | Send a higher revision to correct a day; the latest revision replaces the earlier one |
| `production_date` | yes | `YYYY-MM-DD` |
| `period_start`, `period_end` | yes | Boundaries of the production day |
| `production.actual_good_production_t` | yes | Good production in t; becomes the reported actual, booked to the unit and product chosen on the feed |
| `plan.planned_production_t` | no | OT plan; shown next to Traverse Forge's own figures for comparison |
| `production.shortfall_t` | no | OT shortfall; shown for comparison |
| `status` | no | Source status, shown as "OT status" |
| `production.measurement_quality`, `plant`, `event_type` | no | Kept with the report |

Fields that are not mapped, such as `pi_source`, are ignored.

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
  "lost_production_t": 7.3,
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
| `lost_production_t` | no | Lost production in t |
| `status`, `plant`, `event_type` | no | Kept with the stop |

## What happens with a bad or unknown message

Every such message goes to Connectivity → Quarantine, with the reason and the field named:

| Case | Quarantine item |
|---|---|
| A required field is missing, or a date / time / number cannot be read | `schema_invalid`, naming the field and its path |
| A stop's unit / equipment code is not a Traverse Forge unit or asset | `unknown_unit`. Bind the code to a unit, then replay |
| A reason that is not in the code library | `unknown_code`. The stop is created uncoded and operators code it in the Event Hub |
| The same revision of a PLA day sent again with different numbers | `order_conflict` |
