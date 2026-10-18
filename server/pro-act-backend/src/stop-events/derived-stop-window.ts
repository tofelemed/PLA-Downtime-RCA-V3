import { EntityManager } from 'typeorm';
import { StopEventOptions } from '../periods/stop-event-options';
import { UnitStateMapping } from '../reliability/entities/unit-state-mapping.entity';
import { derivedEventIdPrefix, UnitScope } from './derived-stop-writer';
import { StateEngineCursor } from './entities/state-engine-cursor.entity';

/** Samples of the signal stored after the cursor: the earliest observation (late data) and latest store time. */
const NEW_SAMPLES_SQL = `SELECT min(s."observed_at") AS "observed_from", max(s."inserted_at") AS "seen_through"
  FROM "measurement_samples" s
 WHERE s."tenant_id" = $1 AND s."signal_id" = $2 AND s."inserted_at" > $3 AND s."observed_at" >= $4`;

/** Start of the earliest live derived stop still running at (or ending after) the instant. */
const CROSSING_SQL = `SELECT min(e."start_time") AS "start_time" FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2 AND e."source_kind" = 'derived' AND e."event_id" LIKE $3
   AND e."physical_state" IN ('open', 'closed') AND e."start_time" < $4
   AND (e."end_time" IS NULL OR e."end_time" >= $4)`;

export interface ProcessingWindow {
  start: Date;
  /** latest `inserted_at` of the signal's samples seen by this run */
  samplesSeenThrough: Date;
}

const EPOCH = new Date(0);
const minDate = (...dates: Array<Date | null>) =>
  new Date(
    Math.min(
      ...dates.filter((d): d is Date => d !== null).map((d) => d.getTime()),
    ),
  );

/**
 * Window a run re-derives (plan 1.10 idempotent reprocessing): from the cursor (or, on a first run / a new
 * mapping version, from the mapping start within the lookback), moved back to the earliest late sample
 * (observed after the mapping start and within the late-sample horizon, which may reach further back than
 * the lookback: intake accepts store-and-forward data up to its own past limit, 7 days by default) and
 * by a margin (staleness + debounce + restart confirmation, so an unconfirmed stop or a short restart at
 * the edge is seen whole), and back to the start of a derived stop crossing that instant (its event is
 * re-derived as one piece, never cut).
 */
export async function processingWindow(
  manager: EntityManager,
  input: {
    scope: UnitScope;
    mapping: UnitStateMapping;
    cursor: StateEngineCursor | null;
    settings: StopEventOptions;
    now: Date;
    lookbackMs: number;
    /** how far back a late sample may reopen the window (never shorter than the lookback) */
    lateHorizonMs: number;
  },
): Promise<ProcessingWindow> {
  const { scope, mapping, cursor, settings, now } = input;
  const floorOf = (ms: number) =>
    new Date(Math.max(mapping.effectiveFrom.getTime(), now.getTime() - ms));
  const floor = floorOf(input.lookbackMs);
  const fresh = !cursor || cursor.mappingId !== mapping.id;
  const lateFloor = floorOf(Math.max(input.lookbackMs, input.lateHorizonMs));
  const [news] = await manager.query<
    Array<{ observed_from: Date | null; seen_through: Date | null }>
  >(NEW_SAMPLES_SQL, [
    scope.tenantId,
    mapping.signalId,
    fresh ? EPOCH : cursor.samplesSeenThrough,
    fresh ? floor : lateFloor,
  ]);
  const late = news?.observed_from ? new Date(news.observed_from) : null;
  const base = fresh ? floor : minDate(cursor.processedThrough, late);
  const marginMs =
    (mapping.staleAfterIntervals * mapping.expectedIntervalSeconds +
      mapping.jitterSeconds +
      settings.debounceSeconds +
      settings.restartConfirmSeconds) *
    1000;
  const backed = new Date(
    Math.max(base.getTime() - marginMs, mapping.effectiveFrom.getTime()),
  );
  const [crossing] = await manager.query<Array<{ start_time: Date | null }>>(
    CROSSING_SQL,
    [
      scope.tenantId,
      scope.unitId,
      `${derivedEventIdPrefix(scope.unitId)}%`,
      backed,
    ],
  );
  const crossingStart = crossing?.start_time
    ? new Date(crossing.start_time)
    : null;
  return {
    start: minDate(backed, crossingStart),
    samplesSeenThrough: news?.seen_through
      ? new Date(news.seen_through)
      : (cursor?.samplesSeenThrough ?? EPOCH),
  };
}
