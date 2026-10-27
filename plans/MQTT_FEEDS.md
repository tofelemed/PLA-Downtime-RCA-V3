# MQTT feeds: PLA and downtime on one connection (owner, 26 Oct 2026)

Owner decisions (26 Oct 2026):
- OT publishes two kinds of message on **one MQTT connection**, on different topics: **PLA** (plant production per day) and **Downtime** (stops).
- Each topic is set up as a **feed**: a Purpose dropdown (PLA / Downtime), a topic, and a field mapping. The mapping is a template that is edited once OT confirms the payloads.

How each feed is handled:
- **PLA**
  - The OT **actual** becomes the reported actual.
  - Target and gap come from Traverse Forge's approved plan.
  - OT's own planned and shortfall figures are **kept and shown for comparison**.
  - The day is booked to a **unit and product chosen on the feed**.
- **Downtime**
  - Stops are placed by **unit / equipment code**, matching Traverse Forge unit and asset codes case-insensitively.
  - A source mapping wins when one exists.
  - Both styles work: a start message, then an end message for the same `event_id`; or one closed message.

## Connection settings (`endpointConfig`)

```jsonc
{
  "mqtt": { "brokerUrl": "mqtt://broker:1883", "qos": 1, "topics": [] /* optional in feeds mode: the feed topics are subscribed */, ... },
  "payloadProfile": {
    "kind": "feeds",
    "feeds": [
      {
        "id": "pla",                       // [a-z0-9_-]{1,32}, unique per connection
        "purpose": "pla",                  // "pla" | "downtime"
        "topic": "marun/hdpe/pla",         // MQTT topic filter (+ / # allowed); unique, no overlap between feeds
        "unitId": "<uuid>",                // PLA only, required: unit the plant-day actual is booked to
        "productId": "<uuid>",             // PLA only, required
        "fields": { "actual": "production.actual_good_production_t" }  // optional overrides of the template paths
      },
      {
        "id": "downtime",
        "purpose": "downtime",
        "topic": "marun/hdpe/downtime",
        "durationUnit": "min",             // downtime only: "s" | "min" | "h" (default "min")
        "fields": {}
      }
    ]
  }
}
```

**Rules**
- 1–8 feeds, each with a unique `id` and `topic`.
- A field path is dotted: `^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$`.
- Unknown keys are refused.
- `mqtt.topics` may be empty. The connection subscribes to the feed topics plus `mqtt.topics`.
- Topics are not part of the credential-neutral set: changing a topic does not need the password again, because `payloadProfile` is credential-neutral.

### Template field paths (defaults)

**PLA** (keys are fixed; values are paths in the payload):

| Field | Default path | Required | Meaning |
|---|---|---|---|
| `eventId` | `event_id` | yes | Report identity |
| `revision` | `event_revision` | no (default 1) | A later revision supersedes an earlier one |
| `productionDate` | `production_date` | yes | Plant production day `YYYY-MM-DD` |
| `periodStart` | `period_start` | yes | ISO time with offset |
| `periodEnd` | `period_end` | yes | ISO time with offset |
| `actual` | `production.actual_good_production_t` | yes | Good production (t) |
| `planned` | `plan.planned_production_t` | no | OT plan (t), for comparison |
| `shortfall` | `production.shortfall_t` | no | OT shortfall (t), for comparison |
| `status` | `status` | no (default `REPORTED`) | Source status; release is decided by the source status rules of source system `MQTT` |
| `quality` | `production.measurement_quality` | no | |
| `plant` | `plant` | no | |
| `eventType` | `event_type` | no | |
| `uom` | (none) | no (default `t`) | |

**Downtime:**

| Field | Default path | Required | Meaning |
|---|---|---|---|
| `eventId` | `event_id` | yes | Stop identity; same id = same stop |
| `revision` | `event_revision` | no | |
| `unit` | `unit` | yes, unless `equipment` names an asset of a unit | Unit code |
| `equipment` | `equipment` | no | Asset code |
| `start` | `start_time` | yes | ISO time with offset |
| `end` | `end_time` | no | null / absent = ongoing |
| `duration` | `duration_min` | no | In `durationUnit`; gives the end when `end` is absent and the stop is closed |
| `reason` | `reason_code` | no | Reason code or name; unknown → event uncoded + `unknown_code` quarantine |
| `description` | `description` | no | |
| `lostQuantity` | `lost_production_t` | no | Lost tonnes |
| `status` | `status` | no | |
| `plant` | `plant` | no | |
| `eventType` | `event_type` | no | |

Example payloads: `docs/MQTT_FEEDS_PAYLOADS.md`.

## Runtime

- **Decode.** The topic picks the feed (the first feed whose filter matches). Fields are read by path.
  - Missing required fields, or unparsable times or numbers, give quarantine `schema_invalid`, with the field named.
  - **PLA** gives envelope `kind: output_event`:
    - identity: `sourceObjectId = pla:<eventId>`, `sourceRevision = revision`;
    - time: `startTime/endTime = period`, `observedAt = periodEnd`;
    - values: `values.output = { quantity: actual, unit, productRef: productId, good: true }`, `location.unitId = unitId`;
    - controls: `sourceControls.mqtt = { feed: 'pla', feedId, topic, report: { productionDate, planned, shortfall, status, quality, plant, eventType } }`.
  - **Downtime** gives envelope `kind: interval_event`:
    - identity: `sourceObjectId = downtime:<eventId>`;
    - time: `startTime`, `endTime` (null = open), `observedAt = endTime ?? startTime`;
    - location: `location.sourcePath = unit code`;
    - values: `values.attributes` holds Reason Code, Description, Quantity, Duration, Equipment, Status;
    - controls: `sourceControls.mqtt = { feed: 'downtime', feedId, unit, equipment }`.
- **PLA handler.** Stores an `external_production_reports` record:
  - report: `externalReportId = eventId`, revision, `sourceSystem 'MQTT'`, basis `good`, connectionId;
  - line: one line `{unitId, productId, good: actual}`;
  - comparison: `source_figures` = OT planned / actual / shortfall / status / quality.
  - A newer revision supersedes, the same revision is a duplicate, and conflicting content is quarantined.
  - Period actuals use the report only when it is released and its window equals the period (daily periods).
- **Downtime handler.** Places the stop:
  1. a source mapping for MQTT on the unit / equipment code;
  2. otherwise the unit code, case-insensitive;
  3. otherwise the asset code, whose unit is used.

  Unplaced stops go to quarantine `unknown_unit`. Placed stops go through the existing event pipeline: create the event or revise it, resolve the reason code, apply coding rules.

## API additions

| Endpoint | Change |
|---|---|
| `GET /v2/external-production-reports?connectionId=&state=&limit=&cursor=` | New. Keyset list, newest production date first. Each view includes `sourceFigures` |
| `POST /connections/:id/mqtt-preview` | Adds `feed: { id, purpose } \| null` to the response; `bindingStatus` gains `pla_report` and `downtime_event` |
