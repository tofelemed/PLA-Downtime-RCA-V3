/** Demo governance examples, authored and decided by independent role holders. */
import { ShowcaseContext } from './showcase-context';
import { DAY_MS, iso } from './showcase-window';

interface Version {
  id: string;
  state: string;
  notes?: string;
}

async function uncertainty(
  ctx: ShowcaseContext,
  unitId: string,
): Promise<void> {
  const author = ctx.as('accountants', 0);
  const rows = await author.listAll<Version>('/v2/uncertainty-budgets', {
    unitId,
  });
  let budget = rows.find((row) =>
    row.notes?.startsWith('Demo: HDPE shift mass balance'),
  );
  if (ctx.dryRun) return;
  budget ??= await author.post<Version>(
    '/v2/uncertainty-budgets',
    {
      unitId,
      boundary: 'pellet_outlet',
      uom: 't',
      components: [
        {
          kind: 'meter',
          label: 'Demo: pellet transfer totalizer, standard uncertainty',
          standardUncertainty: '0.3',
        },
        {
          kind: 'scale',
          label: 'Demo: packaging scale, standard uncertainty',
          standardUncertainty: '0.4',
          sensitivity: '-1',
        },
      ],
      coverageFactor: '2',
      calibrationRef:
        'Demo: CAL-HDPE-2026-09 (synthetic certificate reference)',
      reviewDueAt: iso(ctx.window.today + 90 * DAY_MS),
      effectiveFrom: iso(ctx.window.from),
      evidenceRef:
        'Demo: independent 0.3 t and 0.4 t standard uncertainties; expanded 1.0 t',
      notes:
        'Demo: HDPE shift mass balance; illustrative budget, not an actual calibration',
    },
    `HDPE uncertainty ${unitId}`,
  );
  if (budget.state === 'proposed') {
    await ctx.as('metrology', 0).post(
      `/v2/uncertainty-budgets/${budget.id}/approve`,
      {
        reason:
          'Demo: independently checked uncertainty components and coverage factor',
      },
      `approve budget ${budget.id}`,
    );
  }
  await ctx.as('accountants', 1).post(
    `/v2/uncertainty-budgets/${budget.id}/adopt-as-tolerance`,
    {
      notes:
        'Demo: production accounting adopts 1.0 t expanded uncertainty as absolute tolerance',
    },
    `adopt budget ${budget.id}`,
  );
  ctx.tally.created('HDPE uncertainty and tolerance');
}

async function sourceAuthority(
  ctx: ShowcaseContext,
  unitId: string,
): Promise<void> {
  const author = ctx.as('accountants', 0);
  const rows = await author.listAll<Version>('/v2/source-authority/versions', {
    unitId,
  });
  if (
    rows.some((row) => row.notes === 'Demo: HDPE ranked pellet-outlet sources')
  ) {
    ctx.tally.kept('HDPE source authority');
    return;
  }
  if (ctx.dryRun) return;
  const version = await author.post<Version>(
    '/v2/source-authority/versions',
    {
      unitId,
      notes: 'Demo: HDPE ranked pellet-outlet sources',
      measurementHierarchy: {
        boundary: 'pellet_outlet',
        conditions: ['primary_missing', 'primary_bad_quality', 'primary_stale'],
        entries: [
          {
            rank: 1,
            sourceClass: 'reconciled_record',
            source: 'pi_output_ef',
            boundary: 'pellet_outlet',
          },
          {
            rank: 2,
            sourceClass: 'reconciled_record',
            source: 'external_report',
            boundary: 'pellet_outlet',
          },
          {
            rank: 3,
            sourceClass: 'approved_estimate',
            source: 'manual',
            boundary: 'pellet_outlet',
          },
        ],
      },
    },
    `HDPE source authority ${unitId}`,
  );
  await ctx.as('accountants', 1).post(
    `/v2/source-authority/versions/${version.id}/approve`,
    {
      reason:
        'Demo: shift output records are primary; released external records and approved estimates are fallbacks',
    },
    `approve authority ${version.id}`,
  );
  ctx.tally.created('HDPE source authority');
}

async function sourceStatus(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('accountants', 0);
  const { items } = await author.get<{ items: Version[] }>(
    '/v2/source-status-mappings?sourceSystem=demo-lims',
  );
  if (items.length || ctx.dryRun) return;
  const draft = await author.post<Version>(
    '/v2/source-status-mappings',
    {
      sourceSystem: 'demo-lims',
      effectiveFrom: iso(ctx.window.from),
      statuses: [
        { status: 'RELEASED', released: true },
        { status: 'IN_REVIEW', released: false },
        { status: 'REJECTED', released: false },
      ],
      notes:
        'Demo: lab release workflow; only RELEASED records may be authoritative',
    },
    'HDPE LIMS status mapping',
  );
  await ctx
    .as('accountants', 1)
    .post(
      `/v2/source-status-mappings/${draft.id}/approve`,
      {},
      `approve status ${draft.id}`,
    );
  ctx.tally.created('HDPE source status');
}

async function delegation(ctx: ShowcaseContext): Promise<void> {
  const manager = ctx.as('managers', 0);
  const rows = await manager.listAll<{ reason: string }>(
    '/v2/role-delegations',
  );
  const reason = 'Demo: planned shutdown leave cover for unit100';
  if (rows.some((row) => row.reason === reason) || ctx.dryRun) return;
  await manager.post(
    '/v2/role-delegations',
    {
      delegatorId: manager.userId,
      delegateId: ctx.as('managers', 1).userId,
      role: 'manager_approver',
      scopeKind: 'unit',
      scopeId: ctx.ids.units.get('EXT1'),
      validFrom: iso(ctx.window.today),
      validUntil: iso(ctx.window.today + 14 * DAY_MS),
      reason,
    },
    'HDPE shutdown cover',
  );
  ctx.tally.created('HDPE delegation');
}

export async function seedHdpeGovernance(ctx: ShowcaseContext): Promise<void> {
  for (const unitId of ctx.ids.units.values()) {
    await uncertainty(ctx, unitId);
    await sourceAuthority(ctx, unitId);
  }
  await sourceStatus(ctx);
  await delegation(ctx);
}
