# MQTT certification evidence (plan 1.8)

Evidence for `plans/phase-1/1.8-mqtt-adapter.md` and the R1–R16 checks of
`plans/phase-1/1.8-mqtt-integration-plan.md` (WP4). Each section names the test that produced it; nothing
here is claimed without a run.

## Persist-before-ack spike (MQ04, WP3 step 1) — 11 Oct 2026

**Question.** Does mqtt.js delay the QoS 1 PUBACK until the `handleMessage(packet, callback)` callback is
invoked, so that a message can be committed to Postgres before the broker is allowed to forget it? If not,
a local spool (`mqtt_spool`, 1.8 step 5) is mandatory.

**Test.** `server/pro-act-backend/test/integration/mqtt-persist-before-ack-spike.int-spec.ts`
(`[SPIKE MQ04]`), run with `npx jest --selectProjects integration --runInBand test/integration/mqtt-persist-before-ack-spike.int-spec.ts`.
No database; needs the Compose broker only.

| Item | Value |
|---|---|
| mqtt.js | **5.14.0** installed (`package.json` range `^5.3.4`; the design text says 5.3.4 — the installed version is what was tested) |
| Broker | eclipse-mosquitto **2.1.2** (`proact-mqtt-1`, image `eclipse-mosquitto:2.1.2-alpine`, host port 1884, anonymous dev config `docker/mosquitto/mosquitto.conf`, `persistence true`) |
| Protocol versions | MQTT 5 (`protocolVersion: 5`, `properties.sessionExpiryInterval: 300`) and MQTT 3.1.1 (`protocolVersion: 4`) |
| Procedure | subscriber with stable client id, `clean: false`, QoS 1 subscription; a second client publishes 25 QoS 1 messages `m0..m24`; the subscriber's `handleMessage` calls back for `m0` and `m1` and **never** calls back for `m2`; the subscriber is torn down with `client.end(true)` (socket destroyed, no DISCONNECT packet); a new client with the **same client id** and `clean: false` connects and does not re-subscribe |

**Observed (verbatim test output, both runs green):**

```
[SPIKE MQ04 v5] acked=2 held=1 published=25 redelivered=23 dup=20 (broker in-flight window) not-dup=3 (queued, never sent before the crash); held packetId=3 redelivered packetId=3
[SPIKE MQ04 v5] keepalive 2s, callback held 4s: events=held,error:Keepalive timeout,close
[SPIKE MQ04 v4] acked=2 held=1 published=25 redelivered=23 dup=20 (broker in-flight window) not-dup=3 (queued, never sent before the crash); held packetId=3 redelivered packetId=3
[SPIKE MQ04 v4] keepalive 2s, callback held 4s: events=held,error:Keepalive timeout,close
PASS integration test/integration/mqtt-persist-before-ack-spike.int-spec.ts (14.848 s)
  [SPIKE MQ04] mqtt.js handleMessage delays PUBACK (protocolVersion 5)
    √ redelivers exactly the messages whose callback never ran (1804 ms)
    √ caveat: a callback held longer than 1.5 x keepalive makes the client drop the connection (5037 ms)
  [SPIKE MQ04] mqtt.js handleMessage delays PUBACK (protocolVersion 4)
    √ redelivers exactly the messages whose callback never ran (1688 ms)
    √ caveat: a callback held longer than 1.5 x keepalive makes the client drop the connection (5032 ms)
Tests:       4 passed, 4 total
```

**Result: the hook delays the ack in both modes.** In MQTT 5 and in MQTT 3.1.1, after the unclean
disconnect the broker reported `sessionPresent = true` and redelivered exactly `m2..m24` (23 messages) in
order; `m0` and `m1`, whose callbacks had run, were **not** redelivered. `m2` came back with `dup = true` and
the same packet id (3). Messages acknowledged through the callback are released by the broker; messages
whose callback never ran stay in the session. **No spool is needed** (1.8 step 5 stays "not needed";
D09-R "broker releases on ack-after-commit" holds for both protocol versions).

Why it works (verified in `node_modules/mqtt/build/lib/handlers/publish.js` and `client.js`): for QoS 1
mqtt.js calls `client.handleMessage(packet, cb)` and sends `puback` only inside `cb`; incoming packets are
processed strictly one at a time (`work()` pulls the next parsed packet only after the previous handler's
`done`), so the whole inbound pipeline waits behind a pending callback.

**Caveats to carry into step 3 (subscriber host):**

1. **In-flight window.** The broker had already sent 20 of the 23 unacked messages before the crash
   (`dup=20`, mosquitto `max_inflight_messages` default 20; the client sent no `receiveMaximum`), the other 3
   were still queued (`dup=false` on redelivery). A persist-before-ack consumer therefore sees up to the
   in-flight window of messages re-sent with `dup=1` after a crash; `raw_identities` absorbs them (design
   §4.4). The window is a broker setting (or MQTT 5 `receiveMaximum` from our side); design §4.3 "mqtt.js
   stops delivering once the in-flight window is full" is more precisely "mqtt.js stops **reading** the
   socket while a callback is pending", which has the next consequence.
2. **Keepalive while a callback is pending.** Because the inbound pipeline is stalled, PINGRESP is not
   processed either: with keepalive 2 s and a callback held 4 s the client emitted `error: Keepalive timeout`
   and `close` (same in both protocol versions). mqtt.js's `KeepaliveManager` fires after 1.5 × keepalive
   without a PINGRESP. **Consequence for design §4.3 (Postgres down):** holding the ack for longer than
   1.5 × keepalive does not "pause" the session, it drops and (with `reconnectPeriod > 0`) reconnects it,
   and the broker redelivers the in-flight window on every reconnect. The subscriber host must therefore
   bound the time a callback is held (persist with a timeout well below 1.5 × keepalive, e.g. keepalive 60 s
   → persist deadline ≤ 30 s) and, when Postgres is unavailable, **disconnect deliberately** (session kept,
   broker queues) instead of holding callbacks, then reconnect with backoff. Nothing is lost either way (the
   unacked messages are redelivered), but a reconnect storm must be avoided by design, not by luck.
3. **Not covered by this spike:** the lab broker (owner answer #1; repeat the same spec with
   `MQTT_TEST_URL=mqtt(s)://<lab-broker>` once access exists), QoS 2, and a queue larger than
   `max_queued_messages` (R13 sizing). The spike discards the persistent session it created on each run.

## Adapter skeleton tests (WP3 step 1)

See `plans/evidence/phase0-verification.md`, section "Plan 1.8 step 1 verification", for the unit and
integration counts of the step-1 build: `validateConfig` table (design §3), topic-filter overlap, URL
parser, duplicate-feed guard, options factory (TLS modes, derived client id, egress allowlist, no secret
leakage), `assertSecretFollowsTarget` MQTT keys, and `POST /v2/connections` (mqtt) / `discover` / `test`
against the Compose broker (`test/integration/mqtt-adapter.int-spec.ts`).

Wrong-password `test()` is **not** covered yet: the dev mosquitto is anonymous (no `password_file`), so any
credentials are accepted; the unreachable-broker (`ECONNREFUSED`) and egress-denied paths are covered
instead. The password-protected listener arrives with WP3 step 4 (Compose TLS + password file), which will
add the `BadUserNameOrPassword` case to the same spec.

## Live path on the Compose broker (WP3 step 3) — 11 Oct 2026

`MqttSubscriberHost` + persist-before-ack + handlers, exercised end to end against `proact-mqtt-1` (mosquitto
2.1.2, host port 1884, MQTT 5, QoS 1, `clean: false`, `sessionExpiryInterval: 300` in the tests) and
`proact_test` by three integration specs (`npx jest --selectProjects integration --runInBand
test/integration/mqtt-subscriber-*.int-spec.ts`; run output in `plans/evidence/phase0-verification.md`,
"Plan 1.8 step 3"):

| Spec | What it proves |
|---|---|
| `mqtt-subscriber-e2e.int-spec.ts` | one running subscribe job per active connection (`next_run_at` null, lease `host:pid:xxxx`, derived client id, filters + availability topic subscribed; audit `create`, `start` by the host); open event → `production_events` row (unit from the `MQTT` source mapping, reason resolved, `source = MQTT`); `end_ts` revision → same event closed; `delete` → `physical_state = retracted`; raw outcomes `accepted, revision, revision`; unplaceable element → `unknown_template`; unresolved reason → event created uncoded + linked `unknown_code` (`detail.canonicalEventId`); measurement with a registered signal → `measurement_samples`, unknown signal → `unknown_signal`; retained ONLINE / OFFLINE → job health `sourceAvailable` true / false, two `SourceHealthChanged` outbox rows, **no** production event; `GET /v2/ingestion-jobs/:id` shows the health object; `pause` / `resume` through `POST /v2/ingestion-jobs/:id/:action` |
| `mqtt-subscriber-redelivery.int-spec.ts` | (b) `IntakeService.accept` made to fail once → health `persistFailed`, message **not** acknowledged, client disconnects deliberately and reconnects with backoff, broker redelivers with `dup = 1`, accepted exactly once (one raw row, `sourceControls.mqtt.duplicate = true`), one event; (c) the open event re-published retained → `raw_identities.duplicate_count = 1`, no raw row; a later-sent intermediate revision → `stale`; one event, end time kept; counters `duplicate = 1`, `stale = 1`; (d) `not json` ×2, a 70 KB payload, a `ts` one hour ahead → `not_json` (occurrences 2), `too_large`, `future_timestamp`, raw rows `invalid`, all acknowledged; the next event flows, client still connected |
| `mqtt-subscriber-lifecycle.int-spec.ts` | (g) `JobRunnerService.claim` returns null for the subscribe job even with `next_run_at` in the past; (e) a later overlapping connection of the tenant (inserted past the API guard) is parked (`parkedReason = duplicate_feed`, names the winner, no client) and retired when deactivated; (f) pause → disconnected, lease released, a message published meanwhile is **not** delivered; resume → `sessionPresent = true`, the queued message arrives; stop → session dropped: a message published while stopped never arrives after `start` (`sessionPresent = false`), a new one does; audit `create, start, pause, resume, stop, start`; drain → `stopped` with `drained`, nothing delivered afterwards, runner still refuses it; a `PATCH` of the topics bumps `config_version` to 2 and the client restarts with the new filters |

**R1–R11 coverage by these automated tests (WP4 pass criteria still to be run on the lab broker with the
simulator and the real gateway; this is the Compose-broker evidence):**

| # | Check | Automated now | Still open |
|---|---|---|---|
| R1 | Durable before ack | ✅ accept failure → no PUBACK, redelivered, one raw row, one effect (`redelivery` b); `IntakeService.accept` commits before the callback (`message-persister.ts`) | the 1 000-message burst with a killed worker (needs the step-4 simulator) |
| R2 | Redelivery `dup=1` | ✅ `dup = 1` redelivery counted once (`redelivery` b); pause / resume queue drain (`lifecycle` f) | 100-message batch count |
| R3 | Retained state / event on subscribe | ✅ retained event re-send → `duplicate`, no second event; retained availability on connect (`e2e`, `redelivery` c) | retained **state** on reconnect against the 1.10 engine |
| R4 | Event revisions | ✅ open → end → delete; stale intermediate revision ignored (`e2e`, `redelivery` c) | attribute-change revision assertion on the event columns |
| R5 | Postgres down 10 min | ◐ the mechanism (not acked, deliberate disconnect, backoff, redelivery, `persistFailed` in health) with an injected failure (`redelivery` b) | a real outage of the `postgres` container with the queue growing and draining in order |
| R6 | Broker restart | ◐ unintentional close → reconnect with backoff (`mqtt-subscription.ts` `onClose`), config restart (`lifecycle`) | restarting `proact-mqtt-1` mid-run; silence alert (3.12) |
| R7 | Gateway Last Will | ✅ OFFLINE → `sourceAvailable = false`, `SourceHealthChanged`, no stop (`e2e`) | the broker publishing the will itself after a gateway crash (step-4 simulator with a will) |
| R8 | Duplicate feed | ✅ 422 at create / PATCH (step 1); runtime loser parked, oldest wins (`lifecycle` e) | — |
| R9 | Schema violations | ✅ `not_json`, `too_large`, `future_timestamp` quarantined and acked, session not blocked (`redelivery` d); the other codes by the step-2 decoder specs | — |
| R10 | Clock skew | ✅ future `ts` rejected (`redelivery` d); stale window by the step-2 `time-rules` spec | an 8-day-old message through the live path |
| R11 | Unmapped machine / code | ✅ parked `unknown_template` / `unknown_code` / `unknown_signal` with counters (`e2e`); the resolver is loaded per record, so a mapping added later flows on the next message without a restart | the "mapping added → flows" assertion through the live path |
| R12–R16 | load, outage window, security, erase-after-insert, MQTT 3.1.1 live | — (3.1.1 is covered by the spike only) | WP4 |
