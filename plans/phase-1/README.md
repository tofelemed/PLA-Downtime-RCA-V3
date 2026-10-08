# Phase 1 — Events, durable intake and connectors

**Spec epics:** P1 E03 Event integrity · E04 Durable intake · E05 PI certification · E06 MQTT and Kafka
**Exit gate (spec §20):** T01–T06, T18, T37 (E03); replay invariance and crash recovery proven (E04); T07, T08, T25–T27 (E05); T09–T12, T23, T46 (E06).
**Milestones:** M1 vertical slice uses 1.1, 1.2, 1.5, 1.6 (event frames only); M2 needs all of Phase 1.

| Status | Sub-phase | Depends on | Exit tests |
|---|---|---|---|
| 🧪 | [1.1 Event interval model and classifications](1.1-event-interval-model.md) | 0.3, 0.4 | T01 T02 T03 T29 (+T42 advisory rule) — green locally |
| 🧪 | [1.2 Event revisions and source ownership](1.2-event-revisions-and-source-ownership.md) | 1.1 | T04 — green locally |
| 🧪 | [1.3 Hierarchy mapping and code libraries](1.3-hierarchy-mapping-and-code-libraries.md) | 0.4 | T05 T18 — green locally |
| 🧪 | [1.4 Event operations](1.4-event-operations.md) | 1.1, 1.2 | T37 — green locally |
| 🧪 | [1.5 Durable intake core](1.5-durable-intake-core.md) | 0.3, 0.4 | T06; T10 (inbox part); replay invariance; crash recovery — green locally |
| ⬜ | [1.6 PI event frames certified](1.6-pi-event-frames-certified.md) | 1.2, 1.3, 1.5 | T07 T08 T46; §6.4 matrix |
| ⬜ | [1.7 PI actuals: signals, counters, rates](1.7-pi-actuals-signals.md) | 1.5, 1.6 | T25 T26 T27 |
| ⬜ | [1.8 MQTT adapter](1.8-mqtt-adapter.md) | 1.5 | T09 T11 |
| ⬜ | [1.9 Kafka adapter and internal transport](1.9-kafka-adapter-and-internal-transport.md) | 1.5 | T10; T23 (transport) |
| ⬜ | [1.10 Source authority and state engine](1.10-source-authority-and-state-engine.md) | 1.1, 1.7, 1.8/1.9 | T11 T12; DT01–DT07 fixtures |

## Parallel tracks
- **Track A (events):** 1.1 → 1.2 → 1.4; 1.3 alongside.
- **Track B (intake):** 1.5 → 1.6 → 1.7, and 1.5 → 1.8, 1.5 → 1.9.
- **Track C:** 1.10 last, once signals (1.7) and at least one streaming source (1.8 or 1.9) exist.

## Shared artifacts produced in this phase
- `contracts/canonical-event.schema.json` (§5.1) — completed in 1.5 (examples in `contracts/examples/`; backend copy `src/intake/envelope/canonical-event.schema.ts`, drift-checked), used by every adapter.
- `contracts/event-field-catalog.json` — the single list of mappable event fields used by backend validation and the mapping UI (ING04), produced in 1.3.
- `src/domain/time/interval-algebra.ts` — clip/union/split helpers (1.1), reused by accounting in Phase 2.
- PI Web API simulator (`test/simulators/pi-web-api/`) for certification without plant access (1.6).

## Legacy compatibility during Phase 1
`production_events` stays the table name. New columns are added (expand); v1 routes keep working through the legacy status adapter (1.1) until the frontend moves to v2 in Phase 3. No column is dropped in this phase.
