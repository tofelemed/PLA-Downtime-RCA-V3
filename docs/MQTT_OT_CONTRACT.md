# Pro-Act MQTT interface: what we expect from the OT side

**Audience:** the data engineering team that owns the PI → MQTT publisher and designs the topic data model. Pro-Act is a consumer of the broker only; everything between PI and the broker is yours.
**Status:** draft v0.1, 2026-10-11, for review. Pro-Act implements plan 1.8 against this contract; the lab broker is used for acceptance.
**Companion:** `docs/MQTT_INTAKE_DESIGN.md` (how Pro-Act consumes these messages), `plans/phase-1/1.8-mqtt-integration-plan.md` (schedule and tests).

You own the topic namespace and the publisher. This document states the *requirements* a message must meet so Pro-Act can store it exactly once, in order, with the right unit, asset and codes attached. Where we give an example topic or payload, it is an example; where we say **must**, it is a requirement.

---

## 1. Transport

| Item | Requirement | Standard / reason |
|---|---|---|
| Protocol | MQTT **5.0** preferred; 3.1.1 accepted | OASIS MQTT v5.0 (2019), v3.1.1 (2014). MQTT 5 gives session expiry, reason codes and user properties |
| Broker | Plant broker in production; the lab broker for acceptance. Pro-Act connects as a **subscriber only** | IEC 62443: broker sits in the OT/IT conduit; Pro-Act never publishes to OT |
| Port / TLS | **8883 with TLS 1.2 or 1.3**; server certificate whose SAN lists the hostname we connect to; CA certificate handed to us out of band. Plain 1883 only on the lab broker | IANA `secure-mqtt`; RFC 5246 / RFC 8446 |
| Authentication | One broker user per Pro-Act connection, **read-only ACL** limited to our topic filters. No anonymous access. Client certificates (mTLS) optional | least privilege; a duplicated or stray subscriber must not be able to publish |
| QoS | Publish at **QoS 1** | QoS 0 is never queued by the broker; QoS 2 adds cost without benefit because Pro-Act deduplicates |
| Sessions | Broker must support persistent sessions with a **session expiry of at least 24 h** and a per-client queue sized for **24 h of our traffic** (`max_queued_messages` in mosquitto) | Pro-Act may be down for maintenance; the broker is our buffer |
| Keepalive | Publisher keepalive ≤ 60 s | detects a dead publisher within 90 s |
| Message size | ≤ **64 KB** per message | larger messages are rejected |
| Encoding | **UTF-8 JSON object**, one message = one JSON object. No arrays at the root, no binary, no gzip | RFC 8259 |
| Client id | Publisher client id stable and unique; **never** reuse Pro-Act's client ids (`proact-…`) from any tool: the broker evicts the live subscriber | MQTT session semantics |

---

## 2. Topic namespace

You design it. It must satisfy:

1. **Fixed depth per message type**, so a template like `{ns}/{site}/{area}/{line}/{unit}/events` matches every topic of that type; no optional levels.
2. **The equipment identity is in the topic** at known levels, and it is the **same identifier Pro-Act already knows** for that equipment. Best: the **PI AF element path** segments (site / area / line / unit) as named in AF, because Pro-Act's existing PI source mappings key on AF paths. If you use another id, send us the id → AF path table.
3. **One namespace prefix** (`{ns}`, e.g. `proact`) and a **version level** (`v1`) so we can filter tightly and migrate later.
4. **One message type per topic family**: `events`, `measurements/<attribute>`, `state`, `availability`. Do not publish the same value under two families (the reference plant did and received everything twice).
5. Topic levels: ASCII letters, digits, `-`, `_`, `.`; no spaces, no `+`, `#`, `/` inside an id; case-sensitive and consistent.
6. **Do not put tenant or site security in the topic.** Pro-Act takes tenancy from its own connection configuration and only *checks* the topic against it.

Recommended shape (ISA-95 / Unified-Namespace style, IEC 62264 hierarchy):

```
proact/v1/{site}/{area}/{line}/{unit}/events                      downtime / loss event frames
proact/v1/{site}/{area}/{line}/{unit}/measurements/{attribute}    counters, rates, levels
proact/v1/{site}/{area}/{line}/{unit}/state                       current run state (optional, see §3.3)
proact/v1/{site}/gateway/availability                             publisher liveness (retained + Last Will)
```

Example: `proact/v1/HDPE/Polymer/Line1/Extruder1/events`.

---

## 3. Payloads

Common rules for every message:

| Field | Type | Rule |
|---|---|---|
| `schema_version` | string | **Required.** `"1.0"` for this contract; bump on any breaking change |
| `ts` | string | **Required.** Event/observation time in **RFC 3339 with explicit offset or `Z`** (`2026-10-11T06:07:14.187Z`). Milliseconds allowed. Never local time without offset. Never epoch integers |
| `seq` | integer | **Required.** Monotonic per publisher session, starts at 0 after each publisher (re)start |
| `boot_id` | string | **Required.** Changes every time the publisher process (re)starts (UUID or start timestamp). `boot_id` + `seq` is our delivery identity |
| `source` | string | Publisher id, e.g. `pi-mqtt-gw-01` |
| `quality` | object or string | See §3.4; omit only when the source has no quality concept |

All times are the **source time** (PI timestamp), not the publish time. The publisher clock must be NTP-synchronised; Pro-Act rejects timestamps more than 5 minutes in the future and flags timestamps older than the configured window.

### 3.1 Events (downtime, loss) — `…/events`

One message per **event frame change**: on creation (open or closed), on every update (end time set, attribute changed), on deletion. Both start and end come from PI; Pro-Act never derives them.

```jsonc
{
  "schema_version": "1.0",
  "event_id": "EF-7f2c…",                    // REQUIRED, stable for the life of the event: PI Event Frame ID (GUID) or WebId
  "revision": "2026-10-11T06:09:30.000Z",    // REQUIRED, changes on every update: EF LastModified (RFC 3339) or an integer version
  "operation": "upsert",                     // upsert | delete
  "template": "Production Loss",             // PI EF template name (REQUIRED for upsert)
  "element_path": "\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1",   // primary referenced element, AF path (REQUIRED for upsert)
  "start_ts": "2026-10-11T05:40:00.000Z",    // REQUIRED for upsert
  "end_ts": null,                            // null while the event is open; NEVER the PI "9999" sentinel
  "attributes": {                            // EF attribute values by attribute name, as in the template
    "Reason": "Belt trip",
    "Reason Code": "MECH-01",                // digital-state name or code string, as configured in AF
    "Impact Code": "Unplanned",
    "OEE Code": "Availability",
    "Description": "Conveyor belt tripped on overload",
    "Quantity": 12.5,
    "Severity": "High"
  },
  "attribute_units": { "Quantity": "t" },    // optional, UOM per numeric attribute
  "ts": "2026-10-11T06:09:30.100Z",
  "seq": 1844,
  "boot_id": "gw-01-2026-10-11T05:00:00Z",
  "source": "pi-mqtt-gw-01"
}
```

Rules:
- `event_id` + `revision` make an update idempotent: re-sending the same revision is harmless; a newer revision replaces the older; an older revision arriving late is ignored.
- `operation: "delete"` needs only `event_id`, `revision`, `ts`, `seq`, `boot_id`.
- Attribute **names** must match the PI template attribute names exactly; Pro-Act's existing per-template field rules (PI "Production Loss" and others) map them.
- Digital-state attributes (Reason Code, Impact Code, OEE Code): send the **state name** (and optionally `{"name": "MECH-01", "value": 3}`), never only the ordinal.
- A publisher restart must re-publish every event that is **still open** (so Pro-Act can confirm nothing was missed); closed events need not be re-sent.

### 3.2 Measurements — `…/measurements/{attribute}`

One message per sample (counters, rates, levels).

```jsonc
{
  "schema_version": "1.0",
  "signal": "F1DP…webid",                    // REQUIRED, stable id of the PI point / AF attribute (WebId or full AF attribute path)
  "value": 1532.0,                           // number; booleans as true/false; digital states as {"name": "...", "value": n}
  "uom": "t",                                // PI UOM abbreviation
  "ts": "2026-10-11T06:07:14.187Z",          // PI timestamp of the value
  "quality": { "good": true, "questionable": false, "substituted": false },   // PI value flags
  "seq": 1842, "boot_id": "gw-01-…", "source": "pi-mqtt-gw-01"
}
```

Rules: publish on change or on a fixed cadence agreed per signal (Pro-Act is told the cadence and alarms when it is missed); totalisers may roll over, tell us the modulus; never resample or interpolate before publishing.

### 3.3 State — `…/state` (optional)

Only if a machine run-state exists in PI as a digital tag and you want Pro-Act to *derive* stops from it (Pro-Act plan 1.10). If events (§3.1) already carry start and end, this family is not needed for downtime.

```jsonc
{ "schema_version": "1.0", "state": { "name": "RUN", "value": 1 }, "previous": { "name": "STOP", "value": 0 },
  "ts": "…", "quality": { "good": true }, "seq": 1843, "boot_id": "…", "source": "…" }
```

Published **retained** (see §4). The state vocabulary (`RUN`, `STOP`, `IDLE`, …) is listed once in a mapping table you give us.

### 3.4 Quality

Send PI's own flags (`good`, `questionable`, `substituted`, optionally `annotated`). Pro-Act maps them: `good=true & questionable=false` → good; `questionable=true` → uncertain; `good=false` → bad; missing → unknown (never treated as good). If a different system is bridged, tell us which quality convention it uses (OPC UA StatusCode, OPC DA, Sparkplug) and we configure the decoder.

### 3.5 Availability — `…/gateway/availability`

```jsonc
{ "schema_version": "1.0", "state": "ONLINE", "ts": "…", "boot_id": "gw-01-…", "source": "pi-mqtt-gw-01",
  "pi_connected": true }                     // optional: whether the gateway itself can reach PI
```

- Published **retained** with `ONLINE` on every connect.
- Registered as the **Last Will** with `state: "OFFLINE"`, retained, so the broker announces an unclean disappearance.
- Published `OFFLINE` on clean shutdown.
- If the gateway loses PI but keeps the broker, publish `pi_connected: false`; Pro-Act then marks the source degraded rather than silent.

---

## 4. Retained messages and delivery

| Topic family | Retained? | Why |
|---|---|---|
| `availability` | **yes** | the last known liveness must be visible on subscribe |
| `state` | **yes** | the current state must be visible on subscribe; Pro-Act treats a retained state as *stored state*, never as a new transition |
| `measurements` | optional (last value) | useful for dashboards; Pro-Act deduplicates by `signal` + `ts` |
| `events` | optional (last event only) | acceptable **only** because every event carries `event_id` + `revision`; a retained event is a re-send, not a new event. Open events are better re-published on restart (§3.1) than relied on via retain |

Delivery guarantees Pro-Act relies on: QoS 1 at-least-once from the broker + Pro-Act idempotency on (`boot_id`, `seq`) and on (`event_id`, `revision`) = effectively-once. Pro-Act acknowledges a message **only after it is committed to its database**; while Pro-Act is down or unable to write, the broker must queue in the persistent session. Messages are never buffered on disk by Pro-Act outside its database, and a message is released from the broker only by that acknowledgement.

---

## 5. What we need from you before acceptance

1. **Three real sample messages per family** (events open / events closed / delete / measurement / state / availability), produced by the actual gateway, plus the **JSON Schema** if you generate one (we otherwise derive it from this document, draft 2020-12).
2. **Topic list** and the equipment id → AF path table (if ids differ from AF).
3. **Attribute dictionary per template**: attribute name, type, UOM, digital-state set with names and ordinals.
4. **Lab broker details**: host, port, TLS CA, our username/password and ACL, session expiry and queue limits.
5. **Rates**: messages per second steady, and the peak at shift change or a plant trip; number of units and signals.
6. **Clock**: NTP source of the gateway and measured drift.
7. **Gateway behaviour**: what happens on PI outage, on broker outage (local buffer size, replay order), and on restart (re-publish of open events).
8. **Who to call**: broker owner, gateway owner, and the procedure after a broker rebuild (recreate users/ACLs, restart the gateway, verify with `mosquitto_sub -R`).

---

## 6. Standards referenced

- OASIS MQTT Version 5.0 (2019) and MQTT Version 3.1.1 (2014)
- Eclipse Sparkplug 3.0 (optional later: if you choose Sparkplug B, Pro-Act adds a decoder; the rules above still apply to the metrics)
- IEC 62264 / ISA-95 equipment hierarchy (site / area / line / unit) for the topic namespace
- RFC 3339 timestamps (profile of ISO 8601); RFC 8259 JSON; UTF-8
- JSON Schema draft 2020-12 for payload contracts
- RFC 9562 UUIDs where you need to mint ids (`event_id` when no PI id exists, `boot_id`)
- TLS 1.2 (RFC 5246) / TLS 1.3 (RFC 8446); IANA port 8883
- IEC 62443 zones and conduits for the OT/IT boundary (broker placement, least-privilege ACLs)
- AVEVA PI Web API value flags (`Good`, `Questionable`, `Substituted`, `Annotated`) for quality; PI Event Frame `StartTime` / `EndTime` / `LastModified` semantics (open frames have no end; never publish the 9999 sentinel)
