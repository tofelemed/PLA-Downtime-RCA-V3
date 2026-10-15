/** Demo topology: two independent finishing units, each with one full-capacity extruder. */
import { campaignsIn } from './campaigns';
import { UnitSpec } from './catalog-plants';
import { ShowcaseContext } from './showcase-context';
import { DAY_MS, iso } from './showcase-window';

interface Version {
  id: string;
  state: string;
  code?: string;
  assetId?: string;
}

async function stream(ctx: ShowcaseContext, unit: UnitSpec): Promise<void> {
  const unitId = ctx.ids.units.get(unit.key);
  if (!unitId) return;
  const author = ctx.as('authors', 0);
  const existing = await author.listAll<Version>('/v2/unit-streams', {
    unitId,
  });
  if (ctx.dryRun) return;
  const row =
    existing.find((item) => item.code === 'MAIN') ??
    (await author.post<Version>(
      '/v2/unit-streams',
      {
        unitId,
        code: 'MAIN',
        name: `Demo: ${unit.name} extrusion stream`,
        capacityShare: '1',
        effectiveFrom: iso(ctx.window.from),
        notes: 'Demo: single physical extruder, full unit capacity',
      },
      `HDPE stream ${unitId}`,
    ));
  if (row.state === 'draft')
    await ctx
      .as('managers', 0)
      .post(
        `/v2/unit-streams/${row.id}/approve`,
        {},
        `approve stream ${row.id}`,
      );
  const runs = await author.listAll<{ lotCode: string }>('/v2/stream-runs', {
    unitId,
  });
  const lotCode = `DEMO-${unit.code}-${iso(ctx.window.today).slice(0, 10)}`;
  if (!runs.some((run) => run.lotCode === lotCode)) {
    const campaign = campaignsIn(
      unit,
      ctx.window.today,
      ctx.window.today + DAY_MS,
    )[0];
    await ctx.as('engineers', 0).post(
      '/v2/stream-runs',
      {
        unitId,
        streamCode: 'MAIN',
        productId: ctx.ids.products.get(campaign.productCode),
        lotCode,
        startTime: iso(ctx.window.today),
        notes:
          'Demo: current HDPE campaign lot, awaiting end-of-shift lab release',
      },
      `HDPE stream run ${lotCode}`,
    );
  }
  ctx.tally.created('HDPE streams and runs');
}

async function impacts(ctx: ShowcaseContext, unit: UnitSpec): Promise<void> {
  const unitId = ctx.ids.units.get(unit.key);
  if (!unitId) return;
  const author = ctx.as('reliability', 0);
  const existing = await author.listAll<Version>('/v2/unit-impact-rules', {
    unitId,
  });
  for (const kind of ['EXT', 'MTR', 'GBX', 'CUT']) {
    const assetId = ctx.ids.assets.get(`${unit.key}:${kind}`);
    if (!assetId || ctx.dryRun) continue;
    const row =
      existing.find((item) => item.assetId === assetId) ??
      (await author.post<Version>(
        '/v2/unit-impact-rules',
        {
          unitId,
          assetId,
          mode: 'full_stop',
          effectiveFrom: iso(ctx.window.from),
          reason:
            'Demo: failure of this serial component stops the single extrusion train',
        },
        `HDPE impact ${assetId}`,
      ));
    if (row.state === 'draft')
      await ctx
        .as('managers', 0)
        .post(
          `/v2/unit-impact-rules/${row.id}/approve`,
          {},
          `approve impact ${row.id}`,
        );
    ctx.tally.created('HDPE unit impact rules');
  }
}

async function proposedReworkRoute(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 0);
  const fromUnitId = ctx.ids.units.get('EXT1');
  const toUnitId = ctx.ids.units.get('EXT2');
  const rows = await author.listAll<{ notes: string }>('/v2/flow-routes');
  const notes =
    'Demo: proposed off-grade reprocessing campaign from unit100 to unit200; awaits engineering approval. Normal trains are independent.';
  if (rows.some((row) => row.notes === notes) || ctx.dryRun) return;
  // A draft is intentional: do not falsely make two independent finishing trains a serial plant.
  await author.post(
    '/v2/flow-routes',
    {
      fromUnitId,
      toUnitId,
      routeRole: 'alternate',
      yieldFactor: '0.98',
      bufferName: 'Demo: segregated off-grade silo S-120',
      usableInventory: '40',
      minOperatingLevel: '5',
      maxOperatingLevel: '65',
      inventoryUom: 't',
      drawRatePerHour: '2',
      effectiveFrom: iso(ctx.window.today + 14 * DAY_MS),
      notes,
    },
    'HDPE proposed rework route',
  );
  ctx.tally.created('HDPE proposed plant flow');
}

export async function seedHdpeModel(ctx: ShowcaseContext): Promise<void> {
  for (const unit of ctx.scenario.units) {
    await stream(ctx, unit);
    await impacts(ctx, unit);
  }
  await proposedReworkRoute(ctx);
}
