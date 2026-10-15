/**
 * DEMO DATA ONLY (SME E3): product dispositions of the Demo Plant's first HDPE line — an ordered wide-spec
 * lot, a melt-index downgrade, a contaminated purge scrapped, a lot sent to rework and the recovery of
 * that rework two shifts later (reprocessed through the same extruder, so no new output), plus one
 * downgrade still waiting for approval. Quantities are illustrative, not plant data; every lot code starts
 * with "DEMO-" and every evidence / note says "Demo". Recorded by an operator, approved by a manager.
 */
import { loadPeriods, LoadedPeriod } from './period-loader';
import { ShowcaseContext } from './showcase-context';
import { DAY_MS, iso } from './showcase-window';

const HOUR_MS = 3_600_000;

interface DispositionSpec {
  lotCode: string;
  daysAgo: number;
  shiftName: string;
  /** production interval inside the shift: hours from its start */
  fromHour: number;
  toHour: number;
  dispositionClass:
    | 'wide_spec'
    | 'downgrade'
    | 'scrap'
    | 'rework'
    | 'recovered';
  quantity: string;
  note: string;
  approve: boolean;
  /** recovered only: lot code of the disposition it recovers */
  recovers?: string;
}

const SPECS: readonly DispositionSpec[] = [
  {
    lotCode: 'DEMO-L-W601',
    daysAgo: 6,
    shiftName: 'Morning',
    fromHour: 1,
    toHour: 5,
    dispositionClass: 'wide_spec',
    quantity: '3.5',
    note: 'Demo: wide-spec film grade ordered by the customer (good output, reported apart)',
    approve: true,
  },
  {
    lotCode: 'DEMO-L-D412',
    daysAgo: 4,
    shiftName: 'Afternoon',
    fromHour: 2,
    toHour: 4,
    dispositionClass: 'downgrade',
    quantity: '4.2',
    note: 'Demo: melt index above prime specification, sold as off-grade',
    approve: true,
  },
  {
    lotCode: 'DEMO-L-S307',
    daysAgo: 3,
    shiftName: 'Night',
    fromHour: 0,
    toHour: 1,
    dispositionClass: 'scrap',
    quantity: '0.6',
    note: 'Demo: contaminated purge after a screen change, scrapped',
    approve: true,
  },
  {
    lotCode: 'DEMO-L-R205',
    daysAgo: 2,
    shiftName: 'Morning',
    fromHour: 3,
    toHour: 6,
    dispositionClass: 'rework',
    quantity: '1.8',
    note: 'Demo: gels above the limit, sent back to the extruder for rework',
    approve: true,
  },
  {
    lotCode: 'DEMO-L-R205/R1',
    daysAgo: 1,
    shiftName: 'Afternoon',
    fromHour: 1,
    toHour: 2,
    dispositionClass: 'recovered',
    quantity: '1.8',
    note: 'Demo: reworked lot reprocessed through the same extruder and released as prime',
    approve: true,
    recovers: 'DEMO-L-R205',
  },
  {
    lotCode: 'DEMO-L-D118',
    daysAgo: 1,
    shiftName: 'Night',
    fromHour: 4,
    toHour: 6,
    dispositionClass: 'downgrade',
    quantity: '0.9',
    note: 'Demo: density retest pending, proposed as off-grade',
    approve: false,
  },
];

interface DispositionRow {
  id: string;
  lotCode: string;
  state: string;
}

async function periodFor(
  ctx: ShowcaseContext,
  unitId: string,
  spec: DispositionSpec,
): Promise<LoadedPeriod | null> {
  const dayStart = ctx.window.today - spec.daysAgo * DAY_MS;
  const periods = await loadPeriods(
    ctx.as('engineers', 0),
    unitId,
    dayStart,
    dayStart + DAY_MS,
  );
  return periods.find((p) => p.shiftName === spec.shiftName) ?? null;
}

function bodyOf(
  spec: DispositionSpec,
  period: LoadedPeriod,
  recoveryOfId: string | null,
): Record<string, unknown> {
  return {
    unitId: period.unitId,
    productId: period.slices[0].productId,
    lotCode: spec.lotCode,
    dispositionClass: spec.dispositionClass,
    quantity: spec.quantity,
    uom: 't',
    productionStart: iso(period.start + spec.fromHour * HOUR_MS),
    productionEnd: iso(period.start + spec.toHour * HOUR_MS),
    evidenceRef: `Demo LIMS ${spec.lotCode}`,
    reason: spec.note,
    ...(recoveryOfId ? { recoveryOfId, remeasured: true } : {}),
  };
}

async function recordOne(
  ctx: ShowcaseContext,
  spec: DispositionSpec,
  known: Map<string, DispositionRow>,
): Promise<void> {
  const unitId = [...ctx.ids.units.values()][0];
  const period = unitId ? await periodFor(ctx, unitId, spec) : null;
  const recoveryOfId = spec.recovers ? known.get(spec.recovers)?.id : null;
  if (!period?.slices[0] || (spec.recovers && !recoveryOfId)) return;
  const operator = ctx.as('operators', 0);
  const created = await operator.post<DispositionRow>(
    '/v2/lot-dispositions',
    bodyOf(spec, period, recoveryOfId ?? null),
    `disposition ${spec.lotCode}`,
  );
  known.set(spec.lotCode, created);
  ctx.tally.add(
    'lot dispositions',
    1,
    0,
    spec.approve ? 'approved' : 'proposed',
  );
  if (!spec.approve) return;
  await ctx
    .approverOtherThan(ctx.personaOf(operator))
    .post(
      `/v2/lot-dispositions/${created.id}/approve`,
      { reason: 'Demo: lab certificate checked' },
      `approve disposition ${spec.lotCode}`,
    );
  known.set(spec.lotCode, { ...created, state: 'approved' });
}

/** Records the demo dispositions once (lot codes already present are kept); approvals recalculate. */
export async function seedDispositions(ctx: ShowcaseContext): Promise<void> {
  if (ctx.dryRun) {
    ctx.tally.add('lot dispositions', 0, 0, 'dry run: nothing recorded');
    return;
  }
  const unitId = [...ctx.ids.units.values()][0];
  if (!unitId) return;
  const existing = await ctx
    .as('managers', 0)
    .listAll<DispositionRow>('/v2/lot-dispositions', { unitId });
  const known = new Map(existing.map((row) => [row.lotCode, row]));
  for (const spec of SPECS) {
    if (known.has(spec.lotCode)) {
      ctx.tally.kept('lot dispositions');
      continue;
    }
    await recordOne(ctx, spec, known);
  }
}
