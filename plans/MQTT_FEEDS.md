# MQTT feeds: PLA and downtime on one connection (owner, 26 Oct 2026)

Owner decisions (26 Oct 2026):
- OT publishes two kinds of message on **one MQTT connection**, on different topics: **PLA** (plant production per day) and **Downtime** (stops).
- Each topic is set up as a **feed**: a Purpose dropdown (PLA / Downtime), a topic, and a field mapping. The mapping is a template that is edited once OT confirms the payloads.

How each feed is handled:
- **PLA** (changed 27 Oct 2026: the message is a **production loss event**, no longer an external daily report)
  - One message becomes one production loss event `pla:<event_id>` for the unit chosen on the feed and the production day. It carries OT's planned, actual and shortfall; its quantity is the shortfall.
  - People code it in the Event Hub. Under the declared basis (plant setting "Loss accounting") OT's planned figure is the target and OT's actual is the actual.
  - The product on the feed is **optional**.
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
        "unitId": "<uuid>",                // PLA only, required: unit the production loss event is booked to
        "productId": "<uuid>",             // PLA only, optional
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
| `planned` | `plan.planned_production_t` | no | OT planned production (t) |
| `shortfall` | `production.shortfall_t` | yes | OT shortfall (t); the event's quantity. Missing or negative: quarantine `schema_invalid` |
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
| `status` | `status` | no | |
| `plant` | `plant` | no | |
| `eventType` | `event_type` | no | |

Example payloads: `docs/MQTT_FEEDS_PAYLOADS.md`.

## Runtime

- **Decode.** The topic picks the feed (the first feed whose filter matches). Fields are read by path.
  - Missing required fields, or unparsable times or numbers, give quarantine `schema_invalid`, with the field named.
  - **PLA** gives a production loss event:
    - identity: `sourceObjectId = pla:<eventId>`, `sourceRevision = revision`;
    - time: `startTime/endTime = period`, `observedAt = periodEnd`;
    - location: `location.unitId = unitId`;
    - declared figures: planned, actual, shortfall (the quantity), uom, measurement quality, OT status, the OT plan (`plan.*`) and the PI source (`pi_source.*`), the last two optional.
  - **Downtime** gives envelope `kind: interval_event`:
    - identity: `sourceObjectId = downtime:<eventId>`;
    - time: `startTime`, `endTime` (null = open), `observedAt = endTime ?? startTime`;
    - location: `location.sourcePath = unit code`;
    - values: `values.attributes` holds Reason Code, Description, Quantity, Duration, Equipment, Status;
    - controls: `sourceControls.mqtt = { feed: 'downtime', feedId, unit, equipment }`.
- **PLA handler.** Creates or revises the production loss event:
  - `DETECTED` and `CONFIRMED` both create it; a higher `event_revision` revises it and keeps the coding people gave.
  - The same revision with different numbers is quarantined (`order_conflict`); a missing or negative shortfall is quarantined (`schema_invalid`).
  - Review items are raised for an identity mismatch, a window that matches no accounting period, and a second event for the same window.
  - No external daily report is written. The connection's "PLA reports" tab is replaced by a "Production loss events" tab that links to the Event Hub.
- **Downtime handler.** Places the stop:
  1. a source mapping for MQTT on the unit / equipment code;
  2. otherwise the unit code, case-insensitive;
  3. otherwise the asset code, whose unit is used.

  Unplaced stops go to quarantine `unknown_unit`. Placed stops go through the existing event pipeline: create the event or revise it, resolve the reason code, apply coding rules.

## API additions

| Endpoint | Change |
|---|---|
| `GET /v2/external-production-reports?connectionId=&state=&limit=&cursor=` | Existing list of earlier PLA reports; the feed no longer writes new ones |
| `POST /connections/:id/mqtt-preview` | Adds `feed: { id, purpose } \| null` to the response; `bindingStatus` gains `pla_report` (a PLA message, now a production loss event) and `downtime_event` |
