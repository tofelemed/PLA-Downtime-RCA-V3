# MQTT lab testing — the owner demo path (plan 1.8 step 4)

How to see Pro-Act consume contract v1 MQTT messages end to end on your own machine, with the bundled
Compose broker and the publisher simulator instead of PI and the gateway. Everything here exists today.
The console MQTT panel (3.7, plan 1.8 WP3 step 5) is the point-and-click way: Integration console
(`/connectivity`, flag `v2.integrationConsole`) → New → MQTT walks the same configuration as step 4 below
in four steps, and the connection's Subscription / Payload profile / Quarantine tabs show what section 6
reads through the API. The API path stays valid and is what this document shows.

What you need: the Compose stack (`docker compose up -d`, see `docs/DOCKER.md`), `curl`, and the backend
dependencies installed (`cd server/pro-act-backend && npm ci --legacy-peer-deps`) for `npm run mqtt:sim`.

## 0. One-command demo

Sections 2–4 by hand are the way to learn the model. To just see the simulator's events and samples land in
one tenant, the demo seeder does the same configuration through the v2 API, idempotently
(`server/pro-act-backend/scripts/demo-mqtt/`, demo data only, never product defaults):

```bash
cd server/pro-act-backend
npm run db:seed-demo-mqtt -- --demo-plant --dry-run     # shows what it would create; nothing is written
npm run db:seed-demo-mqtt -- --demo-plant               # Demo Plant (the demo manager's own tenant)
npm run db:seed-demo-mqtt -- --tenant <uuid>            # any tenant the seed account may write to
npm run mqtt:sim -- open-close --seed demo --hold 3     # one event: open → closed → attributes changed → retracted
npm run mqtt:sim -- measurements --every 1 --count 3    # three counter samples and three run-state samples
```

What it seeds for the simulator's defaults (`HDPE / Polymer / Line1 / Extruder1`, template `Production Loss`,
signals `F1DPwebid-throughput` / `F1DPwebid-runstate`), each reported as `created` or `kept` (a re-run reports
everything as `kept`):

| Piece | What | Flags |
|---|---|---|
| Unit | `--unit <uuid\|code>`, else a unit coded `Extruder1`, else the demo unit `DEMO-EXTRUDER1` "Extruder 1 (MQTT demo)" is created | `--unit` |
| Codes | reason codes `MECH-01` Mechanical and `ELEC-01` Electrical (defaults: unplanned / availability / impact IC001), impact `IC001`, OEE `OEE002`; existing codes are reused by code, missing ones created | |
| Attribute mapping | one `Production Loss` override whose rules map both the catalog names (`ReasonCode`, `ImpactCode`, `OEECode`, `Description`, `Quantity`, `Severity`) and the contract names (`Reason Code`, `Impact Code`, `OEE Code`) via `aliases`, so `--contract-attribute-names` events code the same way | |
| Placement | `source_mappings` with `sourceSystem = MQTT`: exact path `\\PIAF\HDPE\Polymer\Line1\Extruder1` → the unit, plus topic patterns `proact/v1/HDPE/Polymer/Line1/*/events` (used when an event carries no `element_path`) and `.../*/measurements/*` | |
| Connections | **two** anonymous connections to `mqtt://localhost:1884` (a connection has one payload profile): "Demo: MQTT events (simulator)" (`interval_event_json`, `proact/v1/+/+/+/+/events`, availability topic `proact/v1/HDPE/gateway/availability`) and "Demo: MQTT measurements (simulator)" (`measurement_json`, `proact/v1/+/+/+/+/measurements/+`). The subscriber host of the API/worker process starts their subscribe jobs on its next sweep | `--connection <uuid>`, `--measurements-connection <uuid>` reuse existing ones; `--broker-url` / env `DEMO_MQTT_BROKER_URL` (use `mqtt://mqtt:1883` when the Compose worker hosts the subscriptions) |
| Signals | `F1DPwebid-throughput` (counter, `t`, resets on drop) and `F1DPwebid-runstate` (state), bound to the measurements connection and the unit | |

The simulator sends its codes as **codes** (`MECH-01`, `IC001`, `OEE002`, as the contract example does), because a
code is unique in a library while names may repeat (two reason codes named "Mechanical" would be
`CODE_AMBIGUOUS` and leave the event uncoded).

Then read the results as in section 6: `GET /api/v2/ingestion-jobs?connectionId=…` shows both jobs `running`,
`health.connected = true` and the counters (`received 4 / accepted 4` for `open-close`, `6 / 6` for
`measurements`); `GET /api/v2/production-events?unitIds=<unit>` shows the event with `source = "MQTT"`, an end
time, `reasonCodeId` = MECH-01 and `states.physical = "retracted"` once the delete arrived (its revisions:
`GET /api/v2/production-events/<id>/revisions`); `POST /api/v2/signals/<id>/preview` with a window around the
run lists the stored samples; `GET /api/v2/ingestion-exceptions?connectionId=…` is empty for both connections.
Env: `PROACT_API_URL` (default `http://localhost:$PORT`), `DEMO_SEED_EMAIL` / `DEMO_SEED_PASSWORD` (default
the demo manager, who has the integration-writer and master-data rights the seeder needs).

## 1. Which process does what

| Piece | Where | Notes |
|---|---|---|
| Broker | Compose service `mqtt` (`proact-mqtt-1`) | anonymous `mqtt://localhost:1884`; password `mqtt://localhost:1885`; TLS `mqtts://localhost:8885`. From other containers: `mqtt://mqtt:1883` / `mqtts://mqtt:8883`. Dev users and the CA: `docs/DOCKER.md`, "Broker users and TLS" |
| API | Compose `backend` on `http://localhost:4004/api` | creates the connection, answers the status reads. Uses the **bundled Postgres** (`proact-postgres-1`, host port 5433), not the dev database on 5432 |
| Subscription host | Compose `worker` (`proact-worker-1`, `PROCESS_ROLE=worker`) | `MqttSubscriberHost` reconciles every 10 s (and on the `ConnectionChanged` fast path): one running subscribe job per active MQTT connection, persist-before-ack, health heartbeat. Watch it with `docker compose logs -f worker` |
| Publisher | `npm run mqtt:sim` on the host | plays the gateway of `docs/MQTT_OT_CONTRACT.md` |

The worker connects to the broker **from inside the Compose network**, so the connection's `brokerUrl` must be
`mqtt://mqtt:1883` (or `mqtts://mqtt:8883` with the dev CA), while the simulator on the host uses
`mqtt://localhost:1884`. Both are the same broker.

Alternative without the Compose worker: run a local worker against the dev database
(`cd server/pro-act-backend && PROCESS_ROLE=worker npm run start:worker:dev`, or `npm run start:dev` which hosts
both halves) and point the connection at `mqtt://localhost:1884`. Then the API you call is the local one on
`:4004` with the dev database — do not mix the two: a connection created in one database is invisible to the
other worker.

## 2. Log in and keep the token out of the shell history

```bash
# body files keep passwords out of the command line / history; delete them afterwards
cat > /tmp/login.json <<'EOF'
{ "email": "manager@acme.com", "password": "demo123" }
EOF
TOKEN=$(curl -s -X POST http://localhost:4004/api/auth/login -H 'Content-Type: application/json' \
  -d @/tmp/login.json | python -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
AUTH="Authorization: Bearer $TOKEN"
```

(`docker compose exec backend node dist/scripts/seed-demo-users.js` creates the demo accounts if the login fails.
The user needs integration-writer rights: the demo manager has them.)

## 3. Map the simulated unit

The simulator publishes for `HDPE / Polymer / Line1 / Extruder1` and sends the AF element path
`\\PIAF\HDPE\Polymer\Line1\Extruder1` in every event (contract §2 item 2). Pro-Act places an event on a unit
through a `source_mappings` row for the MQTT source system; without it the events are parked as
`unknown_template` (visible in the exceptions, step 6).

```bash
curl -s "http://localhost:4004/api/v2/units?limit=5" -H "$AUTH"          # pick a unit id → UNIT_ID
cat > /tmp/mapping.json <<EOF
{ "matchKind": "exact_path", "matchValue": "\\\\\\\\PIAF\\\\HDPE\\\\Polymer\\\\Line1\\\\Extruder1",
  "targetType": "unit", "targetId": "$UNIT_ID", "sourceSystem": "MQTT" }
EOF
curl -s -X POST http://localhost:4004/api/v2/source-mappings -H "$AUTH" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" -d @/tmp/mapping.json
```

(The JSON file must contain `\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1` — every backslash doubled; the unquoted
heredoc above unescapes once more, hence the doubled-again backslashes in the command. Check that
`GET /api/v2/source-mappings` shows `matchValue` as `\\PIAF\HDPE\Polymer\Line1\Extruder1`.)

The default attribute names the simulator sends (`ReasonCode`, `Quantity`, `Description`) are the ones the catalog
mapping knows; `ReasonCode: "Mechanical"` resolves when a reason code of that name exists in the tenant, otherwise
the event is created uncoded with a linked `unknown_code` exception. `--contract-attribute-names` sends the spaced
names of the contract examples instead (`Reason Code`, …), which need the WP2 alias rules.

## 4. Create the MQTT connection

```bash
cat > /tmp/connection.json <<'EOF'
{
  "sourceType": "mqtt",
  "displayName": "Lab: Line 1 events (simulator)",
  "endpointConfig": {
    "mqtt": {
      "brokerUrl": "mqtt://mqtt:1883",
      "protocolVersion": 5,
      "username": "lab",
      "qos": 1,
      "cleanStart": false,
      "sessionExpirySeconds": 86400,
      "keepaliveSeconds": 60,
      "connectTimeoutSeconds": 30,
      "reconnect": { "minSeconds": 1, "maxSeconds": 60 },
      "tls": { "mode": "system" },
      "topics": ["proact/v1/HDPE/+/+/+/events"],
      "availabilityTopic": "proact/v1/HDPE/gateway/availability",
      "maxMessageBytes": 65536
    },
    "payloadProfile": {
      "kind": "interval_event_json",
      "schemaVersion": "1.0",
      "topicTemplate": "proact/v1/{site}/{area}/{line}/{unit}/events",
      "fields": { "eventTime": "ts", "sequence": "seq", "bootId": "boot_id" },
      "time": { "unit": "iso", "maxFutureSkewSeconds": 300, "maxPastSeconds": 604800 },
      "quality": { "protocol": "PI" },
      "identityStrategy": "event_id"
    }
  }
}
EOF
curl -s -X POST http://localhost:4004/api/v2/connections -H "$AUTH" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" -d @/tmp/connection.json      # → "id": CONNECTION_ID
curl -s -X POST http://localhost:4004/api/v2/connections/$CONNECTION_ID/test -H "$AUTH"   # CONNACK probe
```

* The anonymous listener ignores the user name; it is required by the configuration only. To use the
  authenticated listeners add `"secret": "proact-test-dev"` to the body with `"username": "proact-test"` and
  `"brokerUrl": "mqtt://mqtt:1885"`, or for TLS `"brokerUrl": "mqtts://mqtt:8883"` with
  `"tls": { "mode": "caPem", "caPem": "<contents of docker/mosquitto/certs/dev-ca.crt>" }`
  (the SAN lists `mqtt`, so no `servername` is needed). `proact-test` is read-only, exactly like a plant user.
* A second connection for the measurements family uses `topics: ["proact/v1/HDPE/+/+/+/measurements/#"]`,
  `payloadProfile.kind: "measurement_json"`, `topicTemplate: ".../measurements/{attribute}"`,
  `identityStrategy: "seq_boot"`, and needs a signal whose `source_key` is the simulator's `--signal`
  (default `F1DPwebid-throughput`) bound to the connection (`POST /api/v2/signals`); unknown signals are
  parked as `unknown_signal`.
* Within 10 s the worker creates the subscribe job: `docker compose logs --since 1m worker` shows the connect
  and the subscribed filters.

## 5. Publish with the simulator

From `server/pro-act-backend` (every scenario prints the topics, `seq`, ids and the outcome Pro-Act should show):

```bash
npm run mqtt:sim -- open-close --hold 20          # open event → closed after 20 s → attribute change → delete
npm run mqtt:sim -- burst --count 1000 --rate 50  # R1/R12: 1 000 closed events, unique ids, one boot_id
npm run mqtt:sim -- measurements --every 2 --count 30
npm run mqtt:sim -- state --sequence RUN,STOP,RUN # retained; parked no_handler until 1.10
npm run mqtt:sim -- availability --hold 30        # retained ONLINE, OFFLINE on clean exit
npm run mqtt:sim -- availability --hold 30 --crash   # R7: no DISCONNECT → the broker publishes the Last Will
npm run mqtt:sim -- duplicates                    # R3/R4: same revision twice, retained re-send, older revision late
npm run mqtt:sim -- poison                        # R9/R10: not JSON, 70 KB, future ts, local-time ts
npm run mqtt:sim -- clear                         # removes the retained messages the scenarios leave behind
```

Options: `--url mqtts://localhost:8885 --username proact-sim --ca ../../docker/mosquitto/certs/dev-ca.crt` with
`MQTT_SIM_PASSWORD=proact-sim-dev` in the environment publishes through the TLS listener; `--protocol 4` is
MQTT 3.1.1; `--site/--area/--line/--unit` change the equipment; `--seed demo` makes ids reproducible (a re-run
with the same seed is a set of duplicates to Pro-Act, which is the point of R2).

## 6. Where to watch the results

| What | Where |
|---|---|
| Subscription health (connected, `sessionPresent`, effective client id, subscribed filters, counters `received / accepted / duplicate / stale / quarantined / parked`, `persistFailed`, `sourceAvailable`, `lastMessageAt`) | `GET /api/v2/ingestion-jobs?connectionId=$CONNECTION_ID` → the job with `scope.mode = "subscribe"`, then `GET /api/v2/ingestion-jobs/$JOB_ID` (`health`) and `GET /api/v2/ingestion-jobs/$JOB_ID/transitions` |
| Pause / resume / drain / stop the subscription | `POST /api/v2/ingestion-jobs/$JOB_ID/pause` (`resume`, `drain`, `stop`, `start`) with `{ "reason": "..." }` |
| Quarantine (poison messages, unmapped units, unknown codes / signals) | `GET /api/v2/ingestion-exceptions?connectionId=$CONNECTION_ID&state=open` (`errorCode` filters: `not_json`, `too_large`, `future_timestamp`, `schema_invalid`, `unknown_template`, `unknown_code`, `unknown_signal`, …); `GET .../$ID` for the detail (raw payload reference, never the body) |
| The events themselves | Event Hub in the frontend (`http://localhost:8070`, the unit you mapped): the open event appears with `source = MQTT`, closes when the `end_ts` revision arrives, and disappears (retracted) on `delete` |
| Raw deliveries, duplicates, retained flags | `docker compose exec postgres psql -U postgres proact -c "select received_at, outcome, source_object_id from raw_observations order by received_at desc limit 20"` |
| Broker side | `docker compose logs -f mqtt` (connects, `u'proact-test'`, Last Will), or `mosquitto_sub -h localhost -p 1884 -t 'proact/#' -v` |
| Audit of the connection and job commands | the Audit page in the frontend (connection create / test, job `create`, `start`, `pause`, `resume`, `stop` by the host or the operator) |

What the scenarios should produce: `open-close` → one event, closed, attributes updated, then retracted; `burst`
→ 1 000 raw rows `accepted`, 1 000 events, counters match, and a second run with the same `--seed` → 1 000
`duplicate`; `duplicates` → outcomes `accepted, revision, duplicate, stale, duplicate`; `availability --crash` →
`health.sourceAvailable = false` within the keepalive, **no** stop or event; `poison` → four open exceptions, the
fifth message accepted and the job still `connected`.

## 7. Clean up

`npm run mqtt:sim -- clear`, then deactivate or stop the connection's job
(`POST /api/v2/ingestion-jobs/$JOB_ID/stop`); `rm /tmp/login.json /tmp/mapping.json /tmp/connection.json`.
