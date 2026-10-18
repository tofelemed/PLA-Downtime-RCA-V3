/**
 * Guide lesson 5, authored by the master-data administrator (Bahram): unit Extruder1, its asset EXT1-Main
 * and the plant-owned products HD5502 and TRAIN-B ("This plant only", t). The legacy unit capacity and
 * product standard cost are left empty: they are not the accounting basis.
 */
import { ASSET, PRODUCTS, UNIT } from './train-catalog';
import { known, TrainContext } from './train-context';

interface Row {
  id: string;
  code: string;
}

interface ProductRow extends Row {
  availability: string;
}

async function ensureUnit(ctx: TrainContext): Promise<void> {
  const author = ctx.as('bahram');
  const units = await author.listAll<Row>('/v2/units');
  const found = units.find((u) => u.code === UNIT.code);
  if (found) {
    ctx.ids.unitId = found.id;
    ctx.tally.kept('units');
    return;
  }
  ctx.tally.created('units');
  if (ctx.dryRun) return;
  const created = await author.post<Row>(
    '/v2/units',
    { ...UNIT },
    `unit ${UNIT.code}`,
  );
  ctx.ids.unitId = created.id;
}

async function ensureAsset(ctx: TrainContext): Promise<void> {
  const author = ctx.as('bahram');
  const assets = await author.listAll<Row>('/v2/assets');
  const found = assets.find((a) => a.code === ASSET.code);
  if (found) {
    ctx.ids.assetId = found.id;
    ctx.tally.kept('assets');
    return;
  }
  ctx.tally.created('assets');
  if (ctx.dryRun || !known(ctx, ctx.ids.unitId, 'unit Extruder1')) return;
  const created = await author.post<Row>(
    '/v2/assets',
    { ...ASSET, unitId: ctx.ids.unitId },
    `asset ${ASSET.code}`,
  );
  ctx.ids.assetId = created.id;
}

async function ensureProducts(ctx: TrainContext): Promise<void> {
  const author = ctx.as('bahram');
  const products = await author.listAll<ProductRow>('/v2/products');
  for (const spec of PRODUCTS) {
    const found = products.find((p) => p.code === spec.code);
    if (found) {
      if (found.availability !== 'plant')
        throw new Error(
          `product ${spec.code} exists but is not "This plant only" (availability cannot change after creation)`,
        );
      ctx.ids.products.set(spec.code, found.id);
      ctx.tally.kept('products');
      continue;
    }
    ctx.tally.created('products');
    if (ctx.dryRun) continue;
    const created = await author.post<ProductRow>(
      '/v2/products',
      {
        code: spec.code,
        name: spec.name,
        description: spec.description,
        uom: 't',
        availability: 'plant',
      },
      `product ${spec.code}`,
    );
    ctx.ids.products.set(spec.code, created.id);
  }
}

export async function seedMasterData(ctx: TrainContext): Promise<void> {
  await ensureUnit(ctx);
  await ensureAsset(ctx);
  await ensureProducts(ctx);
}
