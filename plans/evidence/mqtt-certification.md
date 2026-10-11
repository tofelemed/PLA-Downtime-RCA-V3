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

Wrong-password `test()` was not coverable in step 1 (anonymous dev mosquitto); step 4 added the password and
TLS listeners and `test/integration/mqtt-adapter-auth.int-spec.ts` (see "Authenticated listeners" below).

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

## Authenticated listeners, TLS spike re-run and the simulator (WP3 step 4) — 11 Oct 2026

**Broker.** The bundled Compose `mqtt` service (`docker/mosquitto/mosquitto.conf`, mosquitto 2.1.2) keeps the
anonymous listeners 1883 (host 1884) and 9001 (host 8884) unchanged and adds, with `per_listener_settings true`
(deprecated in 2.1 but the only way to keep 1883 anonymous), a password listener 1885 (host `MQTT_AUTH_PORT`
1885) and a TLS listener 8883 (host `MQTT_TLS_PORT` 8885, `tls_version tlsv1.2`, dev CA + server certificate from
`docker/mosquitto/gen-dev-certs.sh`, SAN localhost / mqtt / proact-mqtt-1 / host.docker.internal / 127.0.0.1 /
::1, 10 years). Both authenticated listeners share `docker/mosquitto/passwd` (dev-only users `proact-test`
read-only on `proact/#`, `test/#`; `proact-sim` read-write on `proact/#`, `test/#`, `spike/#`) and
`docker/mosquitto/acl`. `docker compose config -q` passes; `docker compose up -d mqtt` recreated only the broker
container; the `mqtt-data` volume survived (`Restored 1 clients`, `Restored 1 subscriptions` in the log).

**Host checks with mqtt.js 5.14.0 (scratchpad `broker-check.js`, verbatim):**

```
anon-1884-publish: CONNECTED, publish OK
wrong-password-1885: ERROR code=135 message=Connection refused: Not authorized
wrong-password-1885-v311: ERROR code=5 message=Connection refused: Not authorized
no-credentials-1885: ERROR code=135 message=Connection refused: Not authorized
readonly-user-1885-publish: CONNECTED, publish refused: Publish error: Not authorized (reasonCode 135)
sim-user-1885-publish: CONNECTED, publish OK
tls-8885-with-ca: CONNECTED, publish OK
tls-8885-without-ca: ERROR code=SELF_SIGNED_CERT_IN_CHAIN message=self-signed certificate in certificate chain
tls-8885-with-ca-wrong-name: ERROR code=ERR_TLS_CERT_ALTNAME_INVALID message=Hostname/IP does not match certificate's altnames: Host: nothere.local. is not in the cert's altnames: DNS:localhost, DNS:mqtt, DNS:proact-mqtt-1, DNS:host.docker.internal, IP Address:127.0.0.1, IP Address:0:0:0:0:0:0:0:1
```

Finding: mosquitto 2.1 answers a wrong password with CONNACK **0x87 NotAuthorized** (3.1.1: return code 5), not
0x86 BadUserNameOrPassword; the adapter message is therefore `Broker refused connection: NotAuthorized`
(non-retryable, same operator action). Broker log for the refusals: `disconnected: not authorised.`; the ACL
denial of a QoS 1 publish is a PUBACK with reason 0x87 on MQTT 5 (mqtt.js rejects `publishAsync`), silently
dropped on 3.1.1 as the protocol requires.

**`test()` coverage (`test/integration/mqtt-adapter-auth.int-spec.ts`, `npx jest --selectProjects integration
--runInBand`, verbatim):**

```
PASS integration test/integration/mqtt-adapter-auth.int-spec.ts (12.47 s)
      √ connects with the right password (704 ms)
      √ reports a wrong password as FAILED with the broker reason, non-retryable (MQTT protocol 5) (312 ms)
      √ reports a wrong password as FAILED with the broker reason, non-retryable (MQTT protocol 4) (295 ms)
      √ the read-only subscriber user may subscribe but not publish (ACL) (266 ms)
      √ connects with the CA (tls.mode caPem) (343 ms)
      √ fails without the CA (tls.mode system) and points at the SAN / servername / CA settings (309 ms)
      √ fails with the CA when tls.servername is not in the SAN (IP broker URL: for a DNS host mqtt.js verifies the host itself) (42 ms)
      √ connects without verification in tls.mode insecure (dev only) (349 ms)
Tests:       8 passed, 8 total
```

Caveat found by the servername case: mqtt.js (`build/lib/connect/tls.js`) sets `servername = host` whenever the
broker host is not an IP literal, so the connection setting `tls.servername` only takes effect for IP broker URLs
(the reference's "certificate does not list the host" case is an IP address, so this is the intended use); for a
DNS host the certificate is verified against that host name. The console / validation should say so (step 5).

**Persist-before-ack spike on the TLS listener** (`MQTT_TEST_URL=mqtts://localhost:8885
MQTT_TEST_CA=../../docker/mosquitto/certs/dev-ca.crt MQTT_TEST_USERNAME=proact-sim MQTT_TEST_PASSWORD=...`;
the spec now reads these four variables), verbatim:

```
[SPIKE MQ04 v5] acked=2 held=1 published=25 redelivered=23 dup=20 (broker in-flight window) not-dup=3 (queued, never sent before the crash); held packetId=3 redelivered packetId=3
[SPIKE MQ04 v5] keepalive 2s, callback held 4s: events=held,error:Keepalive timeout,close
[SPIKE MQ04 v4] acked=2 held=1 published=25 redelivered=23 dup=20 (broker in-flight window) not-dup=3 (queued, never sent before the crash); held packetId=3 redelivered packetId=3
[SPIKE MQ04 v4] keepalive 2s, callback held 4s: events=held,error:Keepalive timeout,close
PASS integration test/integration/mqtt-persist-before-ack-spike.int-spec.ts (15.248 s)
Tests:       4 passed, 4 total
```

Same result as on the plain listener (MQ04 holds over TLS 1.3 with password authentication; the broker log shows
`negotiated TLSv1.3 cipher TLS_AES_256_GCM_SHA384`). The lab broker run (owner answer #1) is still pending.

**Publisher simulator** `scripts/mqtt/publish-sim.ts` (`npm run mqtt:sim -- <scenario>`; modules
`sim-messages.ts`, `sim-scenario-support.ts`, `sim-event-scenarios.ts`, `sim-scenarios.ts`): contract v1
messages on `{ns}/{site}/{area}/{line}/{unit}/...`, QoS 1, client id `sim-<random>`, password only from
`MQTT_SIM_PASSWORD`, `--ca` / `--insecure` for mqtts, `--protocol 4|5`, `--seed` for reproducible boot and
event ids. Every scenario ran against 1884 with a logging subscriber on `proact/#` (scratchpad
`sim-runs-1884.log`, `sim-delivered-*.log`): 230 deliveries = 4 (open-close) + 200 (burst) + 6 (measurements)
+ 3 (state) + 2 + 2 (availability, the second pair being the retained ONLINE and the **broker-published Last Will
OFFLINE without `seq`** after `--crash`) + 5 (duplicates) + 5 (poison) + 3 (clear). First lines of each run and
the authenticated runs (`sim-runs-auth.log`) are in `plans/evidence/phase0-verification.md`, "Plan 1.8 step 4".
`burst --count 200 --rate 100` achieved 63 msg/s because each publish awaits its PUBACK; the R12 rate target
needs a pipelined publisher or several simulator processes (open item).

**R-table update:** R7 "broker publishing the will itself" is now exercised by `availability --crash`; R9/R10
have a reusable `poison` scenario; R14 "read-only ACL verified by attempting a publish" and "TLS 1.2+ enforced"
are proven on the Compose broker (`tls_version tlsv1.2`, TLS 1.3 negotiated); R1 burst / R12 load still need the
run against the subscriber host with a killed worker (WP4).
