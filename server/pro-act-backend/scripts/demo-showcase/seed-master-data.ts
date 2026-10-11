/**
 * Units, assets and products of the showcase (v1 routes: v2 has no master-data writes). Existing rows
 * are found by code and kept; the MQTT demo unit `DEMO-EXTRUDER1` is reused for Extruder Line 1 and only
 * renamed. Written by a master-data author.
 */
import { ShowcaseContext } from './showcase-context';

interface UnitRow {
  id: string;
  code: string;
  name: string;
}

interface AssetRow {
  id: string;
  code: string;
  unitId: string;
}

interface ProductRow {
  id: string;
  code: string;
}

export async function seedMasterData(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 0);
  const units = await author.listAll<UnitRow>('/v2/units');
  const byCode = new Map(units.map((u) => [u.code, u]));
  for (const spec of ctx.scenario.units) {
    const existing = byCode.get(spec.code);
    if (existing) {
      ctx.ids.units.set(spec.key, existing.id);
      if (existing.name !== spec.name && !ctx.dryRun) {
        await author.call('PUT', `/units/${existing.id}`, {
          name: spec.name,
          description: spec.description,
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
        unitId,
        assetType: spec.assetType,
        criticality: spec.criticality,
        manufacturer: spec.manufacturer,
        status: 'Operational',
        tenantId: ctx.tenantId,
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
      description: spec.description,
      unitOfMeasure: 't',
      tenantId: ctx.tenantId,
    });
    ctx.ids.products.set(spec.code, created.body.id);
    ctx.tally.created('products');
  }
}
