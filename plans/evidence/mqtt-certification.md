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

## R1–R16 (WP4)

Not started; needs WP3 steps 2–4 and lab broker access.
