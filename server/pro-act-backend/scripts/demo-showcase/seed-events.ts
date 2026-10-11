/**
 * Production history of the window: for every past (and today's finished part of a) shift of every
 * showcase unit, the generated stops, slowdown, quality loss and shift production report, recorded by the
 * plant's operators in parallel. Events already in the plant (same `eventId`) are kept. About 10 % of
 * yesterday's stops, a quarter of today's and a few older ones stay uncoded for the operator queue.
 * Then the open "current" stops (`seed-open-stops.ts`) and a recalculation of the window.
 */
import { generateShift, GeneratedEvent } from './event-generator';
import { outputPayload, PendingEvent, v2Payload } from './event-payloads';
import { UnitSpec } from './catalog-plants';
import { isHoliday } from './campaigns';
import { loadPeriods, LoadedPeriod } from './period-loader';
import { crewOn } from './seed-calendar';
import { openWindow } from './seed-open-stops';
import { inParallel, ShowcaseContext } from './showcase-context';
import { SeededRandom } from './showcase-random';
import { DAY_MS, iso } from './showcase-window';

const CUTOFF_MS = 5 * 60_000;

interface EventRow {
  eventId: string | null;
  isOpen: boolean;
  startTime: string;
}

/** share of stops left uncoded, by age of the operational day */
function uncodedShare(ctx: ShowcaseContext, dayStart: number): number {
  if (dayStart >= ctx.window.today) return 0.25;
  if (dayStart >= ctx.window.today - DAY_MS) return 0.1;
  return 0.03;
}

function operatorName(persona: string): string {
  return persona
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shiftPrefix(unit: UnitSpec, start: number): string {
  return `SC-${unit.key}-${iso(start).slice(0, 13).replace(/[-T]/g, '')}`;
}

/** The pending events of one period (empty for holidays, excluded or unplanned periods). */
function periodEvents(
  ctx: ShowcaseContext,
  unit: UnitSpec,
  period: LoadedPeriod,
  busy: ReadonlyArray<[number, number]>,
): PendingEvent[] {
  if (
    period.isExcluded ||
    period.target <= 0 ||
    isHoliday(period.start) ||
    !period.shiftName
  )
    return [];
  const unitId = ctx.ids.units.get(unit.key) ?? '';
  const prefix = shiftPrefix(unit, period.start);
  const perShift = ctx.scenario.stopsPerDay;
  const shift = generateShift(
    {
      unit,
      shiftName: period.shiftName,
      start: period.start,
      end: period.end,
      target: period.target,
      planningRate: period.planningRate,
      stops: {
        min: Math.ceil(perShift.min / 3),
        max: Math.ceil(perShift.max / 3),
      },
      seed: ctx.seed,
    },
    prefix,
  );
  const cutoff = ctx.window.now - CUTOFF_MS;
  const random = new SeededRandom([ctx.seed, 'coding', unit.key, period.start]);
  const share = uncodedShare(
    ctx,
    period.start - ((period.start - ctx.window.from) % DAY_MS),
  );
  const free = (e: GeneratedEvent) =>
    !busy.some(([s, en]) => e.start < en && e.end > s);
  const pending = shift.events
    .filter((e) => e.end <= cutoff && free(e))
    .map((e) => {
      const uncodable =
        e.kind === 'stop' &&
        (e.leaf.use === 'breakdown' || e.leaf.use === 'minor');
      return v2Payload(
        e,
        unitId,
        unit.key,
        ctx.ids,
        !(uncodable && random.chance(share)),
      );
    });
  if (period.end <= cutoff) {
    const operator = ctx.persona(
      'operators',
      Math.floor(period.start / (8 * 3_600_000)),
    );
    pending.push(
      outputPayload({
        eventId: `${prefix}-OUT`,
        unitId,
        tenantId: ctx.tenantId,
        start: period.start,
        end: period.end,
        shiftName: period.shiftName,
        crew: crewOn(period.localDate, period.shiftName),
        operatorName: operatorName(operator),
        gross: shift.gross,
        rejects: shift.rejects,
      }),
    );
  }
  return pending;
}

async function unitEvents(
  ctx: ShowcaseContext,
  unit: UnitSpec,
): Promise<PendingEvent[]> {
  const unitId = ctx.ids.units.get(unit.key);
  if (!unitId) return [];
  const session = ctx.as('engineers');
  const periods = await loadPeriods(
    session,
    unitId,
    ctx.window.from,
    ctx.window.today + DAY_MS,
  );
  const existing = await session.listAll<EventRow>('/v2/production-events', {
    unitIds: unitId,
    from: iso(ctx.window.from - DAY_MS),
    to: iso(ctx.window.now + DAY_MS),
  });
  const known = new Set(
    existing.map((e) => e.eventId).filter((id): id is string => !!id),
  );
  const busy = existing
    .filter((e) => e.isOpen && e.eventId?.startsWith('SC-'))
    .map((e): [number, number] => [
      Date.parse(e.startTime),
      ctx.window.now + DAY_MS,
    ]);
  const planned = openWindow(ctx, unit.key);
  if (planned) busy.push(planned);
  const pending = periods
    .filter((p) => p.start < ctx.window.now)
    .flatMap((p) => periodEvents(ctx, unit, p, busy));
  const missing = pending.filter((p) => !known.has(p.eventId));
  ctx.tally.add('events', 0, pending.length - missing.length);
  return missing;
}

export async function seedEvents(ctx: ShowcaseContext): Promise<void> {
  const all: PendingEvent[] = [];
  for (const unit of ctx.scenario.units)
    all.push(...(await unitEvents(ctx, unit)));
  ctx.logger.log(`events: ${all.length} to record`);
  if (ctx.dryRun) {
    ctx.tally.add('events', all.length, 0, 'dry run');
    return;
  }
  let done = 0;
  await inParallel(
    ctx.allSessions('operators'),
    all,
    async (session, event) => {
      if (event.route === 'v2') {
        await session.post(
          '/v2/production-events',
          event.body,
          `event ${event.eventId}`,
        );
      } else {
        await session.call('POST', '/production-events', event.body);
      }
      done += 1;
      if (done % 250 === 0) ctx.logger.log(`events: ${done}/${all.length}`);
    },
  );
  ctx.tally.add('events', all.length, 0);
}

/** Recalculates the window (actuals, accounting, KPIs) and waits until today's periods have runs. */
export async function recalculate(ctx: ShowcaseContext): Promise<void> {
  if (ctx.dryRun || ctx.ids.units.size === 0) return;
  const window = {
    unitIds: [...ctx.ids.units.values()],
    from: iso(ctx.window.from),
    to: iso(ctx.window.today + DAY_MS),
  };
  await ctx
    .as('managers', 0)
    .post(
      '/v2/production-periods/recalculate',
      window,
      `recalculate ${window.from} ${window.to} ${ctx.window.now}`,
    );
  ctx.tally.add('recalculation', 1, 0, `${window.from} → ${window.to}`);
}
