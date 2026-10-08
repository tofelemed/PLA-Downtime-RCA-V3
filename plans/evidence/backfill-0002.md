> Run on the fresh dev database of the D: host (no legacy events), 8 Oct 2026. **Re-run on the host with the production-like data (E:\ProAct) before cutover:** `npx ts-node scripts/report-event-backfill.ts > ../../plans/evidence/backfill-0002.md`. The backfill rules themselves are pinned by `test/integration/event-backfill.int-spec.ts` (9 legacy shapes, PI sentinel, durations, tenant_uuid sync).

# EventIntervalModel backfill report

Database `proact`, generated 2026-10-08T14:33:27.308Z.

## Totals

| rows | open_rows | pi_sentinels_converted | tenant_id_not_uuid | interval_check_violations |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 0 | 0 |

## Interval CHECK

| constraint | validated |
| --- | --- |
| CHK_production_events_interval | true |

## Legacy durations (MIG §18.2)

_no rows_

## Classification by legacy event_type

_no rows_

## States by legacy status

_no rows_
