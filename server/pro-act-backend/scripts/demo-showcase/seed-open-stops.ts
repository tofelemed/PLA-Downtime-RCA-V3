/**
 * "Current stops" of the Event Hub: a few stops that are still running now, on different units (one
 * uncoded and past the 60-minute RCA trigger threshold), recorded by operators. Open showcase stops of an
 * earlier day are closed first, and — so that the live view shows only the showcase — stale open stops
 * left behind by the persona and e2e test runs (units `P-REL-*`, `P-…`, `E2E-…`) and simulator stops
 * older than 15 minutes are closed through the v2 close command by a manager (never deleted).
 */
import { ShowcaseContext } from './showcase-context';
import { dayKey, iso } from './showcase-window';

const MINUTE_MS = 60_000;

interface OpenSpec {
  unitKey: string;
  minutesAgo: number;
  reason: string | null;
  assetKind: string | null;
  description: string;
}

const FULL: readonly OpenSpec[] = [
  {
    unitKey: 'EXT1',
    minutesAgo: 38,
    reason: 'MECH-DIE',
    assetKind: 'DIE',
    description: 'Die plate blockage – Extruder 1 die plate, purging',
  },
  {
    unitKey: 'EXT2',
    minutesAgo: 75,
    reason: null,
    assetKind: 'MTR',
    description:
      'Main drive tripped, electrician called – cause to be confirmed',
  },
  {
    unitKey: 'PEL',
    minutesAgo: 22,
    reason: 'MECH-KNF',
    assetKind: 'CUT',
    description: 'Cutter knife broken – Pelletizer cutter hub, changing knives',
  },
  {
    unitKey: 'BAG',
    minutesAgo: 9,
    reason: 'MATL-FILM',
    assetKind: 'FFS',
    description: 'Bag film reel empty, waiting for forklift',
  },
];

const SMALL: readonly OpenSpec[] = [
  {
    unitKey: 'CMP1',
    minutesAgo: 47,
    reason: 'PROC-MELT',
    assetKind: 'DIE',
    description: 'Melt pressure high – Compounder 1 die plate',
  },
];

interface OpenRow {
  id: string;
  eventId: string | null;
  unitId: string;
  source: string | null;
  startTime: string;
  rowVersion: number;
  supersededByEventId: string | null;
  states?: { physical?: string };
}

interface UnitRow {
  id: string;
  code: string;
}

async function closeEvent(
  ctx: ShowcaseContext,
  event: OpenRow,
  reason: string,
  step: string,
): Promise<void> {
  const start = Date.parse(event.startTime);
  const end = Math.min(ctx.window.now - MINUTE_MS, start + 60 * MINUTE_MS);
  if (ctx.dryRun) {
    ctx.tally.created(step);
    return;
  }
  const result = await ctx.as('managers').call(
    'POST',
    `/v2/production-events/${event.id}/close`,
    { endTime: iso(Math.max(end, start + MINUTE_MS)), reason },
    {
      command: `close ${event.id}`,
      ifMatch: event.rowVersion,
      accept: [409],
    },
  );
  if (result.status === 409)
    ctx.tally.add(step, 0, 0, `${event.id} not closable`);
  else ctx.tally.created(step);
}

/** Closes stale open stops of test units and of the simulator (not the showcase's own). */
export async function closeStaleStops(ctx: ShowcaseContext): Promise<void> {
  const session = ctx.as('managers', 0);
  const units = await session.listAll<UnitRow>('/v2/units');
  const codeOf = new Map(units.map((u) => [u.id, u.code]));
  const open = await session.listAll<OpenRow>('/v2/production-events', {
    isOpen: 'true',
  });
  for (const event of open) {
    if (event.eventId?.startsWith('SC-') || event.supersededByEventId) continue;
    if (event.states?.physical && event.states.physical !== 'open') continue;
    const code = codeOf.get(event.unitId) ?? '';
    const test = /^(P-|E2E-)/.test(code);
    const staleSim =
      event.source === 'MQTT' &&
      Date.parse(event.startTime) < ctx.window.now - 15 * MINUTE_MS;
    if (code.startsWith('P-REL-')) {
      await closeEvent(
        ctx,
        event,
        'Closed after the persona reliability test run (stop left open)',
        'closed P-REL test stops',
      );
    } else if (test) {
      await closeEvent(
        ctx,
        event,
        'Closed after the e2e / persona test run (stop left open)',
        'closed other test stops',
      );
    } else if (staleSim) {
      await closeEvent(
        ctx,
        event,
        'Simulator stop without an end message, closed for the demo',
        'closed stale simulator stops',
      );
    }
  }
}

export async function seedOpenStops(ctx: ShowcaseContext): Promise<void> {
  const specs = ctx.scenario.kind === 'full' ? FULL : SMALL;
  const today = dayKey(ctx.window.today);
  for (const spec of specs) {
    const unitId = ctx.ids.units.get(spec.unitKey);
    if (!unitId) continue;
    const open = await ctx
      .as('operators', 0)
      .listAll<OpenRow>('/v2/production-events', {
        unitIds: unitId,
        isOpen: 'true',
      });
    const eventId = `SC-${spec.unitKey}-OPEN-${today}`;
    for (const old of open.filter(
      (e) => e.eventId?.startsWith('SC-') && e.eventId !== eventId,
    )) {
      await closeEvent(
        ctx,
        old,
        'Line restarted',
        'closed earlier showcase stops',
      );
    }
    if (open.some((e) => e.eventId === eventId)) {
      ctx.tally.kept('open stops');
      continue;
    }
    ctx.tally.created('open stops');
    if (ctx.dryRun) continue;
    const body: Record<string, unknown> = {
      eventId,
      unitId,
      startTime: iso(ctx.window.now - spec.minutesAgo * MINUTE_MS),
      physicalType: 'downtime',
      eventType: 'ProductionLoss',
      description: spec.description,
    };
    const reasonId = spec.reason ? ctx.ids.reasons.get(spec.reason) : undefined;
    if (reasonId) body.reasonCodeId = reasonId;
    else body.scheduleClass = 'unplanned';
    const assetId = spec.assetKind
      ? ctx.ids.assets.get(`${spec.unitKey}:${spec.assetKind}`)
      : undefined;
    if (assetId) body.assetId = assetId;
    await ctx
      .as('operators')
      .post('/v2/production-events', body, `open ${eventId}`);
  }
}

/** The interval this run's open stop of the unit occupies (none when the unit gets no open stop). */
export function openWindow(
  ctx: ShowcaseContext,
  unitKey: string,
): [number, number] | null {
  const specs = ctx.scenario.kind === 'full' ? FULL : SMALL;
  const spec = specs.find((s) => s.unitKey === unitKey);
  return spec
    ? [
        ctx.window.now - spec.minutesAgo * MINUTE_MS - 2 * MINUTE_MS,
        ctx.window.now + 86_400_000,
      ]
    : null;
}
