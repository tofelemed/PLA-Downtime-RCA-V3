# Sample PI Web API (Marun HDPE)

A runnable PI Web API you can connect Pro-Act to when the plant PI server is not available. It answers like a real PI Web API and serves days of history plus a live feed. It is sample data only: it never touches a real PI system, and it lives with the test simulator (`server/pro-act-backend/test/simulators/pi-web-api/`), not in product code.

## Start it

```bash
cd server/pro-act-backend
npm run pi:sample
```

It prints the connection URL, the AF server and database WebIds, the elements and the streams, then one line per live change.

| Variable | Default | Meaning |
|---|---|---|
| `PI_SAMPLE_PORT` | `5460` | Listen port |
| `PI_SAMPLE_BIND` | `0.0.0.0` | Listen address (all interfaces, so the Dockerised API can reach it) |
| `PI_SAMPLE_PUBLIC_HOST` | `host.docker.internal` | Host printed in the URL and used in PI `Links`. Use `127.0.0.1` when the API runs on the host (`npm run start:dev`) |
| `PI_SAMPLE_USERNAME` / `PI_SAMPLE_PASSWORD` | `sim-reader` / `sim-only-password` | The Basic account it accepts |
| `PI_SAMPLE_HISTORY_DAYS` | `3` | Days of closed history |
| `PI_SAMPLE_TICK_SECONDS` | `60` | Live feed step |

## Connect Pro-Act to it

Sign in as a SuperAdmin of the plant, then **Connectivity → New connection → PI Web API**:

| Field | Value |
|---|---|
| PI Web API URL | `http://host.docker.internal:5460/piwebapi` (API in Docker) or `http://127.0.0.1:5460/piwebapi` (API on the host) |
| User name / Password | `sim-reader` / `sim-only-password` |
| AF database path | `\\PIAF-MARUN\HDPE` (optional) |

Then follow the stage tracker:

1. **Diagnostics → Run diagnostics.** All six checks should pass, and "batch: yes" is detected and stored.
2. **Discovery and mapping:**
   1. Click **Discover AF databases** and choose `PIAF-MARUN / HDPE`.
   2. Set Hours back to 72 and click **Sample records**.
   3. On an `Extruder1 loss …` row, click **Bind element**, choose unit **Extruder1**, and tick **Also place event frames of its child elements**. This also places the Main Drive frames on Extruder1.
   4. **Map** a row to preview the typed mapping.
3. **Jobs and replay.** Create jobs in this order:
   1. **Limited ingestion.**
   2. **Bounded backfill**, 3 days. It drains and stops by itself.
   3. **Production cadence.**
   4. **Open frames refresh**, **Correction rescan** and **Deletion check**.
4. **Signals → Define signal.** Use name `Extruder1 throughput`, unit Extruder1, source stream id `F1AbMarunExt1Throughput`, kind Rate, `t/h` per hour. Then **Preview / backfill → Backfill from source** and **Preview quantity**.

## What the sample plant contains

| AF element | WebId | In Pro-Act |
|---|---|---|
| `\\PIAF-MARUN\HDPE\Marun\Polymer\Line1` | `F1EmMarunLine1` | — |
| `…\Line1\Extruder1` | `F1EmMarunExtruder1` | unit Extruder1 |
| `…\Line1\Extruder1\Main Drive` | `F1EmMarunExt1MainDrive` | child of Extruder1 (placed through the child pattern) |
| `…\Line1\Pelletizer1` | `F1EmMarunPelletizer1` | **not** a Pro-Act unit, so its frames go to quarantine as `unknown_unit` |

**History**
- **Production Loss frames every 5 h.** Their reason cycles through MECH-GEARBOX, FEED-STARVED, SPEED-LOSS, ELEC-TRIP, GRADE-CHANGE, SCREEN-CHANGE, DRIVE-TRAIN and QUALITY-DOWNGRADE. `SCREEN-CHANGE` is deliberately missing from the HDPE code library, so it arrives uncoded and raises `unknown_code`.
- Every fifth loss is on the Main Drive.
- One Pelletizer stop every 25 h.
- A **Production Output** frame per shift (A 06–14, B 14–22, C 22–06 Tehran) with `GoodQty` and `ScrapQty` in t.
- Throughput (`t/h`) and melt temperature (`°C`) every 5 minutes. Throughput drops during losses.

**Live feed:** each tick opens a loss frame on Extruder1, delivered with PI's open sentinel `9999-12-31T23:59:59Z`, and a later tick closes it. When a shift ends, its output is booked. Stream values are appended.

**Frame attributes**

| Attribute | Delivered as |
|---|---|
| `ReasonCode` | digital state `{Name, Value, IsSystem}` |
| `Duration` | `{Value, UnitsAbbreviation: 'min'}`, on close |
| `Quantity` | lost tonnes, `{Value, UnitsAbbreviation: 't'}`, on close |
| `Description`, `LossCategory`, `Shift`, `Crew`, `OperatorName` | string |

**Real PI Web API shape**
- A frame names its primary element only in `Links.PrimaryReferencedElement` and `RefElementWebIds`.
- Each frame carries `Path`, `Id` and `Links`.
- Times have seven fractional digits.
- `/batch` answers 207.
- A 401 carries `WWW-Authenticate: Basic`.

## Control endpoints (same Basic account)

| Request | Effect |
|---|---|
| `GET /_sample/status` | Number of frames, the open ones, the latest WebIds |
| `POST /_sample/tick` | One live step now |
| `POST /_sample/frames/{webId}/attributes` `{"name":"Description","value":"…"}` | Correct a frame. The next **Correction rescan** picks it up as a revision |
| `POST /_sample/frames/{webId}/delete` | Delete a frame. The next **Deletion check** retracts the event |

Pause then Resume a job in the console to run it now.

## Verified end to end (19 Oct 2026, HDPE plant)

| Check | Result |
|---|---|
| Diagnostics | 6/6 passed; `batch` stored |
| Placement | Extruder1 frames by exact path; Main Drive frames through the child pattern |
| Pelletizer frames | Quarantined `unknown_unit`; marked irrecoverable; not reopened by a later period replay |
| Reason codes | Resolved from the HDPE library. `SCREEN-CHANGE` was created uncoded with an `unknown_code` item. Frames before the codes' effective date (17 Oct 02:00 UTC) were uncoded and flagged |
| Live frames | Open frames had no end time; later polls closed them |
| Correction | A description edited in PI arrived as a revision |
| Deletion | A frame deleted in PI was retracted by the deletion check |
| Replay | Period replay with a dry run; re-normalised retained frames |
| Signal backfill | 266 throughput samples, integrated to 245.8 t over the day |
| Event Hub | Shows the PI events with source PI, coding and classification |

Regression tests:
- `test/integration/pi-real-shape.int-spec.ts` runs the simulator in the real PI shape (`new PiWebApiSimulator({ shape: 'piwebapi' })`).
- The other `pi-certified-*` suites keep the compact shape.
