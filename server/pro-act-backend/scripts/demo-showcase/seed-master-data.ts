/**
 * Units, assets and products of the showcase. Existing demo units are matched by code and their
 * display name, description and reference capacity aligned with the scenario by a master-data author.
 */
import { ShowcaseContext } from './showcase-context';

interface UnitRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  capacity: number | null;
  unitOfMeasure: string | null;
}

interface AssetRow {
  id: string;
  code: string;
  unitId: string;
  organizationId: string | null;
}

interface ProductRow {
  id: string;
  code: string;
  description: string | null;
}

export async function seedMasterData(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 0);
  const units = await author.listAll<UnitRow>('/v2/units');
  const byCode = new Map(units.map((u) => [u.code, u]));
  for (const spec of ctx.scenario.units) {
    const existing = byCode.get(spec.code);
    if (existing) {
      ctx.ids.units.set(spec.key, existing.id);
      if (
        !ctx.dryRun &&
        (existing.name !== spec.name ||
          existing.description !== spec.description ||
          Number(existing.capacity) !== spec.sustainedRate ||
          existing.unitOfMeasure !== 't/h')
      ) {
        await author.call('PUT', `/units/${existing.id}`, {
          name: spec.name,
          description: spec.description,
          capacity: spec.sustainedRate,
          unitOfMeasure: 't/h',
        });
        ctx.tally.add('units', 0, 1, `${spec.code} renamed to "${spec.name}"`);
      } else ctx.tally.kept('units');
      continue;
    }
    if (ctx.dryRun) {
      ctx.tally.add('units', 1, 0, `would create ${spec.code}`);
      continue;
    }
    const created = await author.call<UnitRow>('POST', '/units', {
      code: spec.code,
      name: spec.name,
      description: spec.description,
      capacity: spec.sustainedRate,
      unitOfMeasure: 't/h',
      tenantId: ctx.tenantId,
    });
    ctx.ids.units.set(spec.key, created.body.id);
    ctx.tally.created('units');
  }
  await seedAssets(ctx);
  await seedProducts(ctx);
}

async function alignAssetOrganization(
  ctx: ShowcaseContext,
  asset: AssetRow,
): Promise<void> {
  if (asset.organizationId === ctx.organizationId) return;
  if (asset.organizationId)
    throw new Error(`Demo asset ${asset.code} belongs to another organization`);
  if (!ctx.dryRun)
    await ctx.as('authors', 0).call('PUT', `/assets/${asset.id}`, {
      organizationId: ctx.organizationId,
    });
}

async function seedAssets(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 0);
  const all = await author.get<AssetRow[]>('/assets');
  const unitIds = new Set(ctx.ids.units.values());
  const existing = new Map(
    all.filter((a) => unitIds.has(a.unitId)).map((a) => [a.code, a]),
  );
  for (const unit of ctx.scenario.units) {
    const unitId = ctx.ids.units.get(unit.key);
    for (const spec of unit.assets) {
      const code = `${unit.key}-${spec.kind}`;
      const key = `${unit.key}:${spec.kind}`;
      const found = existing.get(code);
      if (found) {
        await alignAssetOrganization(ctx, found);
        ctx.ids.assets.set(key, found.id);
        ctx.tally.kept('assets');
        continue;
      }
      if (ctx.dryRun || !unitId) {
        ctx.tally.created('assets');
        continue;
      }
      const created = await author.call<AssetRow>('POST', '/assets', {
        code,
        name: spec.name,
        description: `Demo: ${spec.name}; illustrative equipment for the HDPE finishing train, not an installed-equipment claim`,
        unitId,
        assetType: spec.assetType,
        criticality: spec.criticality,
        manufacturer: spec.manufacturer,
        status: 'Operational',
        tenantId: ctx.tenantId,
        organizationId: ctx.organizationId,
      });
      ctx.ids.assets.set(key, created.body.id);
      ctx.tally.created('assets');
    }
  }
}

async function seedProducts(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 0);
  const products = await author.listAll<ProductRow>('/v2/products');
  const byCode = new Map(products.map((p) => [p.code, p]));
  for (const spec of ctx.scenario.products) {
    const found = byCode.get(spec.code);
    if (found) {
      ctx.ids.products.set(spec.code, found.id);
      if (!ctx.dryRun && found.description !== `Demo: ${spec.description}`) {
        await author.call('PUT', `/products/${found.id}`, {
          description: `Demo: ${spec.description}`,
        });
      }
      ctx.tally.kept('products');
      continue;
    }
    if (ctx.dryRun) {
      ctx.tally.created('products');
      continue;
    }
    const created = await author.call<ProductRow>('POST', '/products', {
      code: spec.code,
      name: spec.name,
      description: `Demo: ${spec.description}`,
      unitOfMeasure: 't',
      tenantId: ctx.tenantId,
    });
    ctx.ids.products.set(spec.code, created.body.id);
    ctx.tally.created('products');
  }
}
