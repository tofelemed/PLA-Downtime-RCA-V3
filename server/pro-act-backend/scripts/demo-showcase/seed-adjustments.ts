/**
 * Actuals adjustments and exports of the showcase. Two adjustments on the first extruder: a weighbridge
 * correction five days ago (proposed by an engineer, approved by a manager, then the period is
 * recomputed) and a lab downgrade of yesterday's night shift that is still proposed. Exports: the period
 * summary and the loss lines of an approved week as CSV, requested by a manager.
 */
import { setTimeout as sleep } from 'timers/promises';
import { loadPeriods, LoadedPeriod } from './period-loader';
import { ShowcaseContext } from './showcase-context';
import { DAY_MS, iso } from './showcase-window';

interface AdjustmentSpec {
  daysAgo: number;
  shiftName: string;
  kind: 'gross' | 'reject';
  quantity: string;
  reason: string;
  evidenceRef: string;
  approve: boolean;
}

const ADJUSTMENTS: readonly AdjustmentSpec[] = [
  {
    daysAgo: 5,
    shiftName: 'Afternoon',
    kind: 'gross',
    quantity: '2.4',
    reason:
      'Weighbridge reconciliation: silo 3 transfer of the afternoon shift was not booked by the line counter',
    evidenceRef: 'WB-TICKET-0457',
    approve: true,
  },
  {
    daysAgo: 1,
    shiftName: 'Night',
    kind: 'reject',
    quantity: '0.85',
    reason:
      'Lab retest: lot N3 density below specification, downgraded to off-grade',
    evidenceRef: 'LIMS-QC-1129',
    approve: false,
  },
];

interface PeriodDetail {
  data: { adjustments?: Array<{ evidenceRef: string | null }> };
}

async function periodFor(
  ctx: ShowcaseContext,
  spec: AdjustmentSpec,
): Promise<LoadedPeriod | null> {
  const unitId = [...ctx.ids.units.values()][0];
  if (!unitId) return null;
  const dayStart = ctx.window.today - spec.daysAgo * DAY_MS;
  const periods = await loadPeriods(
    ctx.as('engineers', 0),
    unitId,
    dayStart,
    dayStart + DAY_MS,
  );
  return (
    periods.find((p) => p.shiftName === spec.shiftName && p.target > 0) ?? null
  );
}

export async function seedAdjustments(ctx: ShowcaseContext): Promise<void> {
  for (const spec of ADJUSTMENTS) {
    const period = await periodFor(ctx, spec);
    const sliceId = period?.slices[0]?.id;
    if (!period || !sliceId) continue;
    const engineer = ctx.as('engineers', 1);
    const detail = await engineer.get<PeriodDetail>(
      `/v2/production-periods/${period.id}`,
    );
    if (
      (detail.data.adjustments ?? []).some(
        (a) => a.evidenceRef === spec.evidenceRef,
      )
    ) {
      ctx.tally.kept('actuals adjustments');
      continue;
    }
    ctx.tally.add(
      'actuals adjustments',
      1,
      0,
      spec.approve ? 'approved' : 'proposed',
    );
    const created = await engineer.post<{ id: string }>(
      '/v2/actuals/adjustments',
      {
        sliceId,
        kind: spec.kind,
        quantity: spec.quantity,
        basis: 'measured',
        reason: spec.reason,
        evidenceRef: spec.evidenceRef,
      },
      `adjustment ${spec.evidenceRef}`,
    );
    if (!spec.approve) continue;
    await ctx
      .approverOtherThan(ctx.personaOf(engineer))
      .post(
        `/v2/actuals/adjustments/${created.id}/approve`,
        { reason: 'Weighbridge ticket checked' },
        `approve adjustment ${created.id}`,
      );
    await ctx
      .as('managers', 0)
      .post(
        `/v2/production-periods/${period.id}/recompute`,
        { reason: 'Approved weighbridge adjustment' },
        `recompute ${period.id} ${created.id}`,
      );
    await sleep(3000);
  }
}

interface ExportRow {
  reportType: string;
  filters: { from: string | null; to: string | null };
}

export async function seedExports(ctx: ShowcaseContext): Promise<void> {
  const from = iso(ctx.window.today - 10 * DAY_MS);
  const to = iso(ctx.window.today - 3 * DAY_MS);
  const manager = ctx.as('managers', 1);
  const existing = await manager.listAll<ExportRow>('/v2/exports');
  for (const reportType of ['period_summary', 'loss_lines'] as const) {
    if (
      existing.some(
        (e) =>
          e.reportType === reportType &&
          e.filters.from === from &&
          e.filters.to === to,
      )
    ) {
      ctx.tally.kept('exports');
      continue;
    }
    ctx.tally.created('exports');
    await manager.post(
      '/v2/exports',
      {
        reportType,
        format: 'csv',
        revisionSelector: 'published',
        from,
        to,
        unitIds: [...ctx.ids.units.values()],
      },
      `export ${reportType} ${from} ${to}`,
    );
  }
}
