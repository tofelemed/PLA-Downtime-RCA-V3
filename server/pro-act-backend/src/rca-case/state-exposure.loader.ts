import { EntityManager } from 'typeorm';
import { StateSegment } from '../domain/reliability/unit-state';
import { BoundedInterval } from '../domain/time/interval-algebra';
import { loadStateTimeline } from '../reliability/unit-state/state-timeline.loader';

/** Samples are read in slices of at most a week (one signal, index tenant + signal + observed_at). */
const SLICE_MS = 7 * 86_400_000;

/** The unit's state mapping versions overlapping the window. */
const MAPPING_STARTS_SQL = `SELECT "effective_from", "effective_to" FROM "unit_state_mappings"
 WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "effective_from" < $4
   AND ("effective_to" IS NULL OR "effective_to" > $3)
 ORDER BY "effective_from"`;

/** Slices of the window cut at every mapping boundary and at least every `SLICE_MS`. */
function slicesOf(
  window: BoundedInterval,
  boundaries: readonly number[],
): BoundedInterval[] {
  const start = window.start.getTime();
  const end = window.end.getTime();
  const cuts = new Set<number>(
    boundaries.filter((time) => time > start && time < end),
  );
  for (let time = start + SLICE_MS; time < end; time += SLICE_MS)
    cuts.add(time);
  const points = [start, ...[...cuts].sort((a, b) => a - b), end];
  return points.slice(0, -1).map((point, i) => ({
    start: new Date(point),
    end: new Date(points[i + 1]),
  }));
}

/** A unit's state timeline over a window; `mapped` false = no state mapping version overlaps it. */
export interface UnitStateTimeline {
  mapped: boolean;
  segments: StateSegment[];
}

/**
 * The unit's state timeline over the window across its mapping versions (SME D1 / D2): each slice uses
 * the mapping in force at its start; time without a mapping is left out (unknown to the caller).
 */
export async function unitStateSegments(
  manager: EntityManager,
  scope: { tenantId: string; unitId: string },
  window: BoundedInterval,
): Promise<UnitStateTimeline> {
  const mappings = await manager.query<
    Array<{ effective_from: Date; effective_to: Date | null }>
  >(MAPPING_STARTS_SQL, [
    scope.tenantId,
    scope.unitId,
    window.start,
    window.end,
  ]);
  if (mappings.length === 0) return { mapped: false, segments: [] };
  const boundaries = mappings.flatMap((m) => [
    new Date(m.effective_from).getTime(),
    ...(m.effective_to ? [new Date(m.effective_to).getTime()] : []),
  ]);
  const segments: StateSegment[] = [];
  for (const slice of slicesOf(window, boundaries)) {
    const timeline = await loadStateTimeline(manager, scope, slice);
    if (timeline) segments.push(...timeline);
  }
  return { mapped: true, segments };
}
