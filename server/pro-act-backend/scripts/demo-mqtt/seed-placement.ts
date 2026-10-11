/**
 * Where the simulated events land: the unit of the simulated equipment (an existing one, `--unit`, or a
 * demo unit created through the units API) and the MQTT `source_mappings` rules that place the
 * simulator's element path and topics on it.
 */
import { normalizeMatchValue } from '../../src/source-mapping/mapping-rule';
import {
  DEMO_UNIT,
  PlacementPlan,
  PLACEMENTS,
  SIM_EQUIPMENT,
} from './demo-mqtt-plan';
import {
  createUnlessDryRun,
  Outcome,
  report,
  sameText,
  SeedContext,
  seedKey,
} from './seed-support';

interface UnitRow {
  id: string;
  code: string;
  name: string;
}

interface MappingRow {
  id: string;
  matchKind: string;
  normalizedValue: string;
  sourceSystem: string;
  targetType: string;
  targetId: string;
}

export interface UnitChoice {
  /** null only in a dry run that would create the unit */
  id: string | null;
  code: string;
  outcome: Outcome;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function keep(ctx: SeedContext, unit: UnitRow, note: string): UnitChoice {
  const outcome = report(ctx, {
    what: `unit ${unit.code} "${unit.name}"`,
    status: 'kept',
    id: unit.id,
    note,
  });
  return { id: unit.id, code: unit.code, outcome };
}

/**
 * `--unit <uuid|code>` must exist; otherwise a unit coded like the simulator's `--unit` (`Extruder1`)
 * or the demo unit of an earlier run is reused, and failing both the demo unit is created.
 */
export async function ensureUnit(
  ctx: SeedContext,
  requested: string | null,
): Promise<UnitChoice> {
  const units = await ctx.client.listAll<UnitRow>('/api/v2/units');
  if (requested) {
    const unit = units.find(
      (row) =>
        (UUID.test(requested) && row.id === requested) ||
        sameText(row.code, requested),
    );
    if (!unit) {
      throw new Error(`--unit ${requested}: no such unit in the tenant`);
    }
    return keep(ctx, unit, 'given by --unit');
  }
  const existing =
    units.find((row) => sameText(row.code, SIM_EQUIPMENT.unit)) ??
    units.find((row) => sameText(row.code, DEMO_UNIT.code));
  if (existing) return keep(ctx, existing, 'matches the simulated equipment');
  const outcome = await createUnlessDryRun(
    ctx,
    `unit ${DEMO_UNIT.code} "${DEMO_UNIT.name}"`,
    () => createDemoUnit(ctx),
  );
  return { id: outcome.id, code: DEMO_UNIT.code, outcome };
}

/** The v1 units API is the only unit writer; the tenant id in the body must be the seeded tenant. */
async function createDemoUnit(ctx: SeedContext): Promise<{ id: string }> {
  const { body } = await ctx.client.write<UnitRow>('POST', '/api/units', {
    ...DEMO_UNIT,
    tenantId: ctx.tenantId,
  });
  return { id: body.id };
}

/** One rule per plan entry; an active rule with the same kind and normalised value is kept as it is. */
export async function ensurePlacements(
  ctx: SeedContext,
  unitId: string | null,
): Promise<Outcome[]> {
  const existing = await ctx.client.listAll<MappingRow>(
    '/api/v2/source-mappings',
  );
  const outcomes: Outcome[] = [];
  for (const plan of PLACEMENTS) {
    const what = `source mapping ${plan.matchKind} ${plan.matchValue}`;
    const normalized = normalizeMatchValue(plan.matchKind, plan.matchValue);
    const found = existing.find(
      (row) =>
        row.matchKind === plan.matchKind &&
        row.normalizedValue === normalized &&
        (row.sourceSystem === 'MQTT' || row.sourceSystem === '*'),
    );
    if (found) {
      const note =
        found.targetId === unitId
          ? `→ ${found.targetType} ${found.targetId}`
          : `targets ${found.targetType} ${found.targetId}, not the chosen unit; left as is`;
      outcomes.push(report(ctx, { what, status: 'kept', id: found.id, note }));
      continue;
    }
    outcomes.push(
      await createUnlessDryRun(ctx, what, () =>
        createPlacement(ctx, plan, unitId),
      ),
    );
  }
  return outcomes;
}

async function createPlacement(
  ctx: SeedContext,
  plan: PlacementPlan,
  unitId: string | null,
): Promise<{ id: string }> {
  if (!unitId) throw new Error('no unit to place the simulated events on');
  const body = {
    matchKind: plan.matchKind,
    matchValue: plan.matchValue,
    targetType: 'unit',
    targetId: unitId,
    sourceSystem: 'MQTT',
    precedence: 0,
    description: plan.description,
  };
  const { body: created } = await ctx.client.write<MappingRow>(
    'POST',
    '/api/v2/source-mappings',
    body,
    {
      idempotencyKey: seedKey([
        ctx.tenantId,
        'source-mapping',
        plan.matchKind,
        plan.matchValue,
        unitId,
      ]),
    },
  );
  return { id: created.id };
}
