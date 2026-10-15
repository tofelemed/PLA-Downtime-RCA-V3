import { Dec, toDec, ZERO } from '../actuals/decimal';
import {
  FlowInput,
  FlowRoute,
  LossEvent,
  PeriodAccountingInput,
} from './accounting.types';
import { isStoppingDowntime } from './segmentation';

/** A unit's loss of supply over `[start, end)` (ms), caused by `cause` on `originUnitId`. */
interface Outage {
  start: number;
  end: number;
  cause: LossEvent;
  originUnitId: string;
}

/** Upstream levels followed at most (a longer chain is a configuration error, not a plant). */
const MAX_DEPTH = 8;
const MS_PER_HOUR = 3_600_000;

const inForce = (route: FlowRoute, at: number) =>
  route.from.getTime() <= at && (route.to === null || route.to.getTime() > at);

/** Union of outages; an overlap keeps the cause that started first (first-out, SME Q11). */
function merged(outages: readonly Outage[]): Outage[] {
  const sorted = [...outages].sort(
    (a, b) =>
      a.start - b.start || a.cause.eventId.localeCompare(b.cause.eventId),
  );
  const result: Outage[] = [];
  for (const outage of sorted) {
    const last = result[result.length - 1];
    if (last && outage.start <= last.end) {
      last.end = Math.max(last.end, outage.end);
      continue;
    }
    result.push({ ...outage });
  }
  return result;
}

/** Parts of `outages` inside `windows` (both sorted and disjoint per list). */
function intersect(
  outages: readonly Outage[],
  windows: ReadonlyArray<{ start: number; end: number }>,
): Outage[] {
  return outages.flatMap((o) =>
    windows.flatMap((w) => {
      const start = Math.max(o.start, w.start);
      const end = Math.min(o.end, w.end);
      return end > start ? [{ ...o, start, end }] : [];
    }),
  );
}

/** Parts of `outages` outside `cuts`. */
function subtract(
  outages: readonly Outage[],
  cuts: ReadonlyArray<{ start: number; end: number }>,
): Outage[] {
  return outages.flatMap((o) => {
    let pieces: Outage[] = [o];
    for (const cut of cuts) {
      pieces = pieces.flatMap((p) => {
        if (cut.end <= p.start || cut.start >= p.end) return [p];
        const left = { ...p, end: cut.start };
        const right = { ...p, start: cut.end };
        return [left, right].filter((x) => x.end > x.start);
      });
    }
    return pieces;
  });
}

/**
 * Usable buffer of a route at `at`: the latest recorded level not older than the limit, above the lowest
 * operating level; else the configured usable inventory; 0 without a buffer.
 */
function usableAt(flow: FlowInput, route: FlowRoute, at: number): Dec {
  const recorded = flow.levels
    .filter(
      (l) =>
        l.fromUnitId === route.fromUnitId &&
        l.toUnitId === route.toUnitId &&
        l.at.getTime() <= at &&
        at - l.at.getTime() <= flow.maxLevelAgeSeconds * 1000,
    )
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  if (recorded) {
    const usable = new Dec(recorded.level).minus(toDec(route.minLevel) ?? ZERO);
    return usable.gt(ZERO) ? usable : ZERO;
  }
  return toDec(route.usableInventory) ?? ZERO;
}

/** Milliseconds the buffer keeps the downstream unit running once supply stops (cover = usable ÷ draw). */
function coverMs(flow: FlowInput, route: FlowRoute, at: number): number {
  const draw = toDec(route.drawRatePerHour);
  if (!draw || draw.lte(ZERO)) return 0;
  return usableAt(flow, route, at)
    .div(draw)
    .mul(MS_PER_HOUR)
    .toDecimalPlaces(0, Dec.ROUND_FLOOR)
    .toNumber();
}

interface Walk {
  flow: FlowInput;
  asOf: number;
  depth: number;
  visiting: ReadonlySet<string>;
}

/** Outages of a unit's own supply to its downstream: its recorded stops and its own starvation. */
function outagesOf(unitId: string, walk: Walk): Outage[] {
  const recorded = walk.flow.upstreamStops
    .filter((s) => s.unitId === unitId)
    .map((s) => ({
      start: s.event.start.getTime(),
      end: (s.event.end ?? new Date(walk.asOf)).getTime(),
      cause: s.event,
      originUnitId: unitId,
    }))
    .filter((o) => o.end > o.start);
  return merged([...recorded, ...starvationOf(unitId, walk)]);
}

/** The starved part of each feed route's upstream outage: after the buffer's cover, to the outage's end. */
function starvedBy(route: FlowRoute, walk: Walk): Outage[] {
  return outagesOf(route.fromUnitId, walk).flatMap((outage) => {
    if (!inForce(route, outage.start)) return [];
    const start = outage.start + coverMs(walk.flow, route, outage.start);
    return start < outage.end ? [{ ...outage, start }] : [];
  });
}

/**
 * SME E2 starvation of a unit: each feed route's upstream outage (recorded stops and, recursively, the
 * upstream unit's own starvation) after its buffer cover; while alternate routes exist, only the time
 * every alternate's upstream is out too.
 */
function starvationOf(unitId: string, walk: Walk): Outage[] {
  if (walk.depth >= MAX_DEPTH || walk.visiting.has(unitId)) return [];
  const next: Walk = {
    ...walk,
    depth: walk.depth + 1,
    visiting: new Set([...walk.visiting, unitId]),
  };
  const routes = walk.flow.routes.filter((r) => r.toUnitId === unitId);
  const feeds = routes.filter((r) => r.role === 'feed');
  let starved = merged(feeds.flatMap((r) => starvedBy(r, next)));
  for (const alternate of routes.filter((r) => r.role === 'alternate')) {
    starved = intersect(starved, merged(outagesOf(alternate.fromUnitId, next)));
  }
  return starved;
}

/**
 * SME E2: derived starvation stops of the period's unit, as availability causes charged to the upstream
 * stop that started them (`starvedFrom` = its unit, schedule class external). An upstream stop first
 * consumes the buffer's usable cover (100 t at 20 t/h = 5 h: a 2 h stop costs nothing, a 7 h stop 2 h of
 * starvation); the unit's own recorded stops are facts and take precedence over derived time. Empty
 * without a flow map.
 */
export function starvationStops(input: PeriodAccountingInput): LossEvent[] {
  const flow = input.flow;
  if (!flow || flow.routes.length === 0) return [];
  const asOf = input.asOf.getTime();
  const own = input.events
    .filter(isStoppingDowntime)
    .map((e) => ({
      start: e.start.getTime(),
      end: (e.end ?? input.asOf).getTime(),
    }));
  const window = [
    { start: input.window.start.getTime(), end: input.window.end.getTime() },
  ];
  const walk: Walk = { flow, asOf, depth: 0, visiting: new Set() };
  const starved = intersect(
    subtract(starvationOf(flow.unitId, walk), own),
    window,
  );
  return starved.map((o) => ({
    ...o.cause,
    physicalType: 'downtime',
    start: new Date(o.start),
    end: new Date(o.end),
    scheduleClass: 'external',
    oeeComponent: 'availability',
    impactMode: 'full_stop',
    impactFraction: null,
    quantity: null,
    plannedEnd: null,
    transition: null,
    recoveryOfEventId: null,
    streamId: null,
    starvedFrom: o.originUnitId,
  }));
}
