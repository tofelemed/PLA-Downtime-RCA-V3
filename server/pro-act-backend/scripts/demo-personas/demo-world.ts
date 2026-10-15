/**
 * The organisations, plants, units, products and feature flags the demo personas live in. Rows are
 * ensured by code through the same SQL path `scripts/seed-demo-users.ts` uses, so re-runs keep what
 * exists and only report what they created.
 */
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { ensureDemoTransitionPolicy } from './demo-oee-policy';
import { DEMO_PLANT_UNIT_CODES, PlantKey } from './persona-catalog';

export interface PlantRow {
  id: string;
  code: string;
  name: string;
  organizationId: string;
}

export interface DemoWorld {
  organizations: { demoOrg: string; partnerOrg: string };
  plants: Record<PlantKey, PlantRow>;
  /** `${plant}:${unitCode}` → units.id */
  units: Map<string, string>;
}

export interface WorldSummary {
  created: string[];
  kept: string[];
}

const PLANTS: Record<
  PlantKey,
  { code: string; name: string; org: 'demoOrg' | 'partnerOrg' }
> = {
  demoPlant: { code: 'demo-plant', name: 'HDPE', org: 'demoOrg' },
  demoPlant2: { code: 'demo-plant-2', name: 'Demo Plant 2', org: 'demoOrg' },
  partnerPlant: {
    code: 'partner-plant',
    name: 'Partner Plant',
    org: 'partnerOrg',
  },
};

const UNITS: ReadonlyArray<{ plant: PlantKey; code: string; name: string }> = [
  { plant: 'demoPlant', code: DEMO_PLANT_UNIT_CODES[0], name: 'unit100' },
  { plant: 'demoPlant', code: DEMO_PLANT_UNIT_CODES[1], name: 'unit200' },
  { plant: 'demoPlant2', code: 'DP2-LINE-1', name: 'Line 1' },
  { plant: 'demoPlant2', code: 'DP2-LINE-2', name: 'Line 2' },
  { plant: 'partnerPlant', code: 'PP-LINE-1', name: 'Partner Line 1' },
];

const PRODUCTS: ReadonlyArray<{ plant: PlantKey; code: string; name: string }> =
  [
    { plant: 'demoPlant2', code: 'DP2-PROD-A', name: 'Product A' },
    { plant: 'demoPlant2', code: 'DP2-PROD-B', name: 'Product B' },
    { plant: 'partnerPlant', code: 'PP-PROD-A', name: 'Partner Product A' },
  ];

export function unitKey(plant: PlantKey, unitCode: string): string {
  return `${plant}:${unitCode}`;
}

/** Same shape as seed-demo-users: find by `code`, otherwise insert the given columns. */
async function ensureByCode(
  client: Client,
  table: 'organizations' | 'tenants',
  code: string,
  values: Record<string, unknown>,
  summary: WorldSummary,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM ${table} WHERE code = $1`,
    [code],
  );
  if (existing.rows.length) {
    summary.kept.push(`${table} ${code}`);
    return existing.rows[0].id;
  }
  const row = { id: randomUUID(), code, ...values };
  const columns = Object.keys(row);
  await client.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
  summary.created.push(`${table} ${code}`);
  return row.id;
}

/** Units and products are unique per (tenant_id, code); an existing row is kept as is. */
async function ensureTenantRow(
  client: Client,
  table: 'units' | 'products',
  plant: PlantRow,
  item: { code: string; name: string },
  summary: WorldSummary,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM ${table} WHERE tenant_id = $1 AND code = $2`,
    [plant.id, item.code],
  );
  if (existing.rows.length) {
    summary.kept.push(`${table} ${plant.code}/${item.code}`);
    return existing.rows[0].id;
  }
  const id = randomUUID();
  await client.query(
    `INSERT INTO ${table} (id, code, name, tenant_id, organization_id) VALUES ($1, $2, $3, $4, $5)`,
    [id, item.code, item.name, plant.id, plant.organizationId],
  );
  summary.created.push(`${table} ${plant.code}/${item.code}`);
  return id;
}

/** Copies every feature flag of `from` onto `to` (same keys, same values); existing rows are updated. */
async function copyFeatureFlags(
  client: Client,
  from: PlantRow,
  to: PlantRow,
  summary: WorldSummary,
): Promise<void> {
  const source = await client.query<{ key: string; enabled: boolean }>(
    `SELECT key, enabled FROM feature_flags WHERE tenant_id = $1 ORDER BY key`,
    [from.id],
  );
  for (const flag of source.rows) {
    const result = await client.query<{ inserted: boolean }>(
      `INSERT INTO feature_flags (id, tenant_id, key, enabled, row_version)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (tenant_id, key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [randomUUID(), to.id, flag.key, flag.enabled],
    );
    const bucket = result.rows[0].inserted ? summary.created : summary.kept;
    bucket.push(`feature_flags ${to.code}/${flag.key}=${flag.enabled}`);
  }
}

async function ensurePlants(
  client: Client,
  organizations: DemoWorld['organizations'],
  summary: WorldSummary,
): Promise<Record<PlantKey, PlantRow>> {
  const plants = {} as Record<PlantKey, PlantRow>;
  for (const key of Object.keys(PLANTS) as PlantKey[]) {
    const plant = PLANTS[key];
    const organizationId = organizations[plant.org];
    const id = await ensureByCode(
      client,
      'tenants',
      plant.code,
      { name: plant.name, organization_id: organizationId },
      summary,
    );
    plants[key] = { id, code: plant.code, name: plant.name, organizationId };
  }
  return plants;
}

export async function ensureDemoWorld(
  client: Client,
  summary: WorldSummary,
): Promise<DemoWorld> {
  const organizations = {
    demoOrg: await ensureByCode(
      client,
      'organizations',
      'demo-org',
      { name: 'Demo Org' },
      summary,
    ),
    partnerOrg: await ensureByCode(
      client,
      'organizations',
      'partner-org',
      { name: 'Partner Org' },
      summary,
    ),
  };
  const plants = await ensurePlants(client, organizations, summary);
  const units = new Map<string, string>();
  for (const unit of UNITS) {
    const id = await ensureTenantRow(
      client,
      'units',
      plants[unit.plant],
      unit,
      summary,
    );
    units.set(unitKey(unit.plant, unit.code), id);
  }
  for (const product of PRODUCTS) {
    await ensureTenantRow(
      client,
      'products',
      plants[product.plant],
      product,
      summary,
    );
  }
  await copyFeatureFlags(client, plants.demoPlant, plants.demoPlant2, summary);
  // the showcase history with grade transitions lives in the Demo Plant (LA-08)
  await ensureDemoTransitionPolicy(client, plants.demoPlant, summary);
  return { organizations, plants, units };
}

/** Owner's final showcase: one organization, one plant and exactly the two requested units. */
export async function ensureHdpeWorld(
  client: Client,
  summary: WorldSummary,
): Promise<DemoWorld> {
  const organizationId = await ensureByCode(
    client,
    'organizations',
    'demo-org',
    { name: 'HDPE' },
    summary,
  );
  await client.query(
    "UPDATE organizations SET name='HDPE', updated_at=now() WHERE id=$1",
    [organizationId],
  );
  const id = await ensureByCode(
    client,
    'tenants',
    'demo-plant',
    { name: 'HDPE', organization_id: organizationId },
    summary,
  );
  await client.query(
    "UPDATE tenants SET name='HDPE', organization_id=$2, updated_at=now() WHERE id=$1",
    [id, organizationId],
  );
  const plant: PlantRow = {
    id,
    code: 'demo-plant',
    name: 'HDPE',
    organizationId,
  };
  const units = new Map<string, string>();
  for (const unit of UNITS.filter((row) => row.plant === 'demoPlant')) {
    units.set(
      unitKey('demoPlant', unit.code),
      await ensureTenantRow(client, 'units', plant, unit, summary),
    );
  }
  await ensureDemoTransitionPolicy(client, plant, summary);
  // Compatibility keys identify the same plant; no additional organization or tenant is inserted.
  return {
    organizations: { demoOrg: organizationId, partnerOrg: organizationId },
    plants: { demoPlant: plant, demoPlant2: plant, partnerPlant: plant },
    units,
  };
}

/** Current value of one flag per plant (registry default `false` when unset), for the verify probes. */
export async function flagValues(
  client: Client,
  world: DemoWorld,
  key: string,
): Promise<Record<PlantKey, boolean>> {
  const values = {} as Record<PlantKey, boolean>;
  for (const plant of Object.keys(world.plants) as PlantKey[]) {
    const result = await client.query<{ enabled: boolean }>(
      `SELECT enabled FROM feature_flags WHERE tenant_id = $1 AND key = $2`,
      [world.plants[plant].id, key],
    );
    values[plant] = result.rows[0]?.enabled ?? false;
  }
  return values;
}
