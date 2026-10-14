/**
 * Reliability records of the full showcase plant (SME D9 / D10), through the v2 API, all marked "Demo"
 * and illustrative: a standby process-water pump B on the pelletizer with its start-demand, proof-test and
 * running log (one failed start), and CMMS work-order operations (diagnosis, waiting for parts, repair,
 * functional test) for the longest asset breakdowns, whose failure detail is coded from the demo
 * dictionary. Idempotent: log entries carry their own refs, operations upsert on work order + operation.
 */
import { DEMO_FAILURE_BY_ASSET_TYPE } from './catalog-failure-dictionary';
import { ShowcaseContext } from './showcase-context';
import { SeededRandom } from './showcase-random';
import { DAY_MS, HOUR_MS } from './showcase-window';

interface AssetRow {
  id: string;
  code: string;
  unitId: string;
  assetType: string | null;
}

interface EventRow {
  id: string;
  unitId: string;
  assetId: string | null;
  startTime: string;
  endTime: string | null;
  rowVersion: number;
  failure: { mode: string | null; severity: string | null } | null;
}

const iso = (ms: number) => new Date(ms).toISOString();
const dayKey = (ms: number) => iso(ms).slice(0, 10).replace(/-/g, '');
const STANDBY_CODE = 'PEL-PMPB';
const DEMO = 'Demo (illustrative)';
const WORK_ORDERS = 30;
const MIN_BREAKDOWN_MS = 45 * 60_000;

async function standbyPump(ctx: ShowcaseContext): Promise<string | null> {
  const unitId = ctx.ids.units.get('PEL');
  if (!unitId) return null;
  const author = ctx.as('authors', 0);
  const assets = await author.listAll<AssetRow>('/v2/assets', {
    unitIds: [unitId],
  });
  const found = assets.find((a) => a.code === STANDBY_CODE);
  if (found) return found.id;
  if (ctx.dryRun) return null;
  const created = await author.post<AssetRow>(
    '/v2/assets',
    {
      code: STANDBY_CODE,
      name: 'Process water pump B (standby)',
      unitId,
      assetType: 'Pump',
      criticality: 'High',
      manufacturer: 'KSB',
      status: 'Operational',
      description: 'Demo standby pump of the process water loop (illustrative)',
    },
    'standby pump asset',
  );
  return created.id;
}

/** Demands about every 9 days (the duty pump trips), one failed start, runs after the good starts, monthly tests. */
function standbyLog(
  ctx: ShowcaseContext,
  assetId: string,
): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = [];
  let index = 0;
  for (
    let day = ctx.window.from;
    day + DAY_MS < ctx.window.now;
    day += DAY_MS
  ) {
    const random = new SeededRandom([ctx.seed, 'standby', dayKey(day)]);
    const key = dayKey(day);
    if (index % 30 === 0) {
      records.push({
        assetId,
        kind: 'test',
        startedAt: iso(day + 10 * HOUR_MS),
        endedAt: iso(day + 10.5 * HOUR_MS),
        outcome: 'success',
        externalRef: `DEMO-PMPB-TST-${key}`,
        notes: `${DEMO}: monthly proof test run 30 min`,
      });
    }
    if (index % 9 === 4) {
      const start = day + random.between(1, 20) * HOUR_MS;
      const failed = Math.floor(index / 9) === 2;
      records.push({
        assetId,
        kind: 'demand',
        startedAt: iso(start),
        outcome: failed ? 'failed_start' : 'success',
        externalRef: `DEMO-PMPB-DEM-${key}`,
        notes: failed
          ? `${DEMO}: failed to start on demand — seized coupling, duty pump restarted`
          : `${DEMO}: duty pump tripped, standby started`,
      });
      if (!failed) {
        records.push({
          assetId,
          kind: 'run',
          startedAt: iso(start),
          endedAt: iso(start + random.between(4, 9) * HOUR_MS),
          outcome: 'success',
          externalRef: `DEMO-PMPB-RUN-${key}`,
          notes: `${DEMO}: ran until the duty pump was back`,
        });
      }
    }
    index += 1;
  }
  return records;
}

async function seedStandby(ctx: ShowcaseContext): Promise<void> {
  const assetId = await standbyPump(ctx);
  if (!assetId) {
    ctx.tally.add('standby pump (demo)', 1, 0, 'dry run');
    return;
  }
  const engineer = ctx.as('reliability', 0);
  const registered = await engineer.listAll<{ assetId: string }>(
    '/v2/standby-equipment',
    { assetIds: [assetId] },
  );
  if (registered.length === 0 && !ctx.dryRun) {
    await engineer.post(
      '/v2/standby-equipment',
      {
        assetId,
        evaluation: 'demand_and_running',
        effectiveFrom: iso(ctx.window.from),
        notes: `${DEMO}: spare of the process water pump`,
      },
      'standby register',
    );
  }
  const records = standbyLog(ctx, assetId);
  ctx.tally.add(
    'standby log entries (demo)',
    records.length,
    0,
    'demands, tests, runs; one failed start',
  );
  if (ctx.dryRun || records.length === 0) return;
  await engineer.post(
    '/v2/standby-records/import',
    { records },
    `standby log ${dayKey(ctx.window.now)}`,
  );
}

/** Operations of one breakdown: diagnosis, repair with waiting for parts, functional test (illustrative shares). */
function operationsOf(event: EventRow): Array<Record<string, unknown>> {
  const start = Date.parse(event.startTime);
  const length = Date.parse(event.endTime as string) - start;
  const at = (share: number) => iso(start + Math.round(length * share));
  const order = {
    workOrderId: `DEMO-WO-${event.id.slice(0, 8).toUpperCase()}`,
    eventId: event.id,
    source: 'Demo CMMS (illustrative)',
  };
  return [
    {
      ...order,
      operationId: '0010',
      kind: 'diagnosis',
      startedAt: at(0.1),
      endedAt: at(0.25),
      description: `${DEMO}: fault finding`,
    },
    {
      ...order,
      operationId: '0020',
      kind: 'repair',
      startedAt: at(0.25),
      endedAt: at(0.8),
      waitingSeconds: Math.round((length * 0.15) / 1000),
      waitingReason: 'Spare part from central store',
      description: `${DEMO}: repair`,
    },
    {
      ...order,
      operationId: '0030',
      kind: 'test',
      startedAt: at(0.8),
      endedAt: at(0.88),
      description: `${DEMO}: functional test before hand-back`,
    },
  ];
}

async function longestBreakdowns(
  ctx: ShowcaseContext,
  assets: ReadonlyMap<string, string>,
): Promise<EventRow[]> {
  const events = await ctx
    .as('managers', 0)
    .listAll<EventRow>('/v2/production-events', {
      unitIds: [...ctx.ids.units.values()],
      physicalTypes: 'downtime',
      scheduleClasses: 'unplanned',
      from: iso(ctx.window.from),
      to: iso(ctx.window.now),
    });
  const length = (e: EventRow) =>
    Date.parse(e.endTime as string) - Date.parse(e.startTime);
  return events
    .filter(
      (e) =>
        e.assetId &&
        e.endTime &&
        assets.has(e.assetId) &&
        length(e) >= MIN_BREAKDOWN_MS,
    )
    .sort((a, b) => length(b) - length(a) || a.id.localeCompare(b.id))
    .slice(0, WORK_ORDERS);
}

async function codeFailure(
  ctx: ShowcaseContext,
  event: EventRow,
  assetType: string,
  n: number,
): Promise<void> {
  if (event.failure?.mode) return;
  const [item, mode, mechanism, cause, detection] =
    DEMO_FAILURE_BY_ASSET_TYPE[assetType];
  await ctx.as('managers', 0).call(
    'PATCH',
    `/v2/production-events/${event.id}`,
    {
      failureSeverity: n % 3 === 2 ? 'degraded' : 'critical',
      maintainableItem: item,
      failureMode: mode,
      failureMechanism: mechanism,
      failureCause: cause,
      detectionMethod: detection,
    },
    { ifMatch: event.rowVersion, accept: [409, 412, 422] },
  );
}

async function seedWorkOrders(ctx: ShowcaseContext): Promise<void> {
  const unitIds = [...ctx.ids.units.values()];
  const assets = await ctx
    .as('authors', 0)
    .listAll<AssetRow>('/v2/assets', { unitIds });
  const typeOf = new Map(
    assets
      .filter((a) => a.assetType && DEMO_FAILURE_BY_ASSET_TYPE[a.assetType])
      .map((a) => [a.id, a.assetType as string]),
  );
  const breakdowns = await longestBreakdowns(ctx, typeOf);
  ctx.tally.add(
    'CMMS work orders (demo)',
    breakdowns.length,
    0,
    '3 operations each, failure detail coded',
  );
  if (ctx.dryRun || breakdowns.length === 0) return;
  const operations = breakdowns.flatMap((event) => operationsOf(event));
  await ctx
    .as('reliability', 0)
    .post(
      '/v2/work-order-operations/import',
      { operations },
      `work orders ${dayKey(ctx.window.now)}`,
    );
  // coded after the operations exist, so the recalculation the change triggers reads the repair evidence
  for (const [n, event] of breakdowns.entries()) {
    await codeFailure(
      ctx,
      event,
      typeOf.get(event.assetId as string) as string,
      n,
    );
  }
}

export async function seedReliabilityRecords(
  ctx: ShowcaseContext,
): Promise<void> {
  ctx.logger.log(
    'Demo reliability records: standby pump log and CMMS work-order operations (illustrative)',
  );
  await seedStandby(ctx);
  await seedWorkOrders(ctx);
}
