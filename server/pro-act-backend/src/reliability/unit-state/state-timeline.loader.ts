import { EntityManager } from 'typeorm';
import { BoundedInterval } from '../../domain/time/interval-algebra';
import {
  StateConfig,
  StateSample,
  StateSegment,
  stateTimeline,
} from '../../domain/reliability/unit-state';
import { UnitStateMapping } from '../entities/unit-state-mapping.entity';

/** The state mapping of the unit in force at the instant (one row per unit and version). */
export function mappingInForce(
  manager: EntityManager,
  scope: { tenantId: string; unitId: string },
  at: Date,
): Promise<UnitStateMapping | null> {
  return manager
    .getRepository(UnitStateMapping)
    .createQueryBuilder('m')
    .where('m.tenantId = :tenantId AND m.unitId = :unitId', scope)
    .andWhere(
      'm.effectiveFrom <= :at AND (m.effectiveTo IS NULL OR m.effectiveTo > :at)',
      { at },
    )
    .orderBy('m.version', 'DESC')
    .getOne();
}

/** Latest revision of every sample of the signal in the window, plus the last one before it. */
const SAMPLES_SQL = `SELECT DISTINCT ON (s."observed_at") s."observed_at", s."state_name", s."state_value",
       s."value"::text AS "value", s."quality"
  FROM "measurement_samples" s
 WHERE s."tenant_id" = $1 AND s."signal_id" = $2 AND s."observed_at" >= $3 AND s."observed_at" < $4
 ORDER BY s."observed_at", s."inserted_at" DESC`;

const BEFORE_SQL = `SELECT s."observed_at", s."state_name", s."state_value", s."value"::text AS "value", s."quality"
  FROM "measurement_samples" s
 WHERE s."tenant_id" = $1 AND s."signal_id" = $2 AND s."observed_at" < $3
 ORDER BY s."observed_at" DESC, s."inserted_at" DESC LIMIT 1`;

interface SampleRow {
  observed_at: Date;
  state_name: string | null;
  state_value: number | null;
  value: string | null;
  quality: StateSample['quality'];
}

const toSample = (row: SampleRow): StateSample => ({
  at: new Date(row.observed_at),
  value:
    row.state_name ??
    (row.state_value !== null ? String(row.state_value) : null) ??
    (row.value !== null ? String(Number(row.value)) : null),
  quality: row.quality,
});

/** The engine configuration of a mapping and its signal's quality policy. */
export async function stateConfigOf(
  manager: EntityManager,
  mapping: UnitStateMapping,
): Promise<StateConfig> {
  const rows = await manager.query<
    Array<{ quality_policy: { acceptUncertain?: boolean } | null }>
  >(
    `SELECT "quality_policy" FROM "signals" WHERE "id" = $1 AND "tenant_id" = $2`,
    [mapping.signalId, mapping.tenantId],
  );
  return {
    rules: mapping.rules,
    expectedIntervalSeconds: mapping.expectedIntervalSeconds,
    jitterSeconds: mapping.jitterSeconds,
    staleAfterIntervals: mapping.staleAfterIntervals,
    heartbeat: mapping.isHeartbeat,
    acceptUncertain: rows[0]?.quality_policy?.acceptUncertain === true,
  };
}

/**
 * SME D1 / D2: the unit's state timeline over a window from its mapped state signal; null when the unit
 * has no mapping in force at the window start (no state engine for it yet). Bounded by one signal and the
 * window (index tenant + signal + observed_at).
 */
export async function loadStateTimeline(
  manager: EntityManager,
  scope: { tenantId: string; unitId: string },
  window: BoundedInterval,
): Promise<StateSegment[] | null> {
  const mapping = await mappingInForce(manager, scope, window.start);
  if (!mapping) return null;
  const params = [scope.tenantId, mapping.signalId];
  // one connection in the run's transaction: the two reads run one after the other
  const before = await manager.query<SampleRow[]>(BEFORE_SQL, [
    ...params,
    window.start,
  ]);
  const inside = await manager.query<SampleRow[]>(SAMPLES_SQL, [
    ...params,
    window.start,
    window.end,
  ]);
  const config = await stateConfigOf(manager, mapping);
  return stateTimeline([...before, ...inside].map(toSample), config, window);
}
