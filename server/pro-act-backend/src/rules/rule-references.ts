import { EntityManager } from 'typeorm';
import { fieldSpec, RuleFieldSpec } from './grammar/rule-catalog';
import {
  isCondition,
  isSetAction,
  RuleDefinition,
} from './grammar/rule-definition';
import { ruleReferenceInvalid } from './rule-errors';

type Reference = NonNullable<RuleFieldSpec['references']>;

/** Table and tenant predicate per referenced record. */
const LOOKUPS: Readonly<
  Record<Reference, { table: string; label: string; tenant: string }>
> = {
  reason_code: {
    table: 'reason_codes',
    label: 'reason code',
    tenant: '"tenant_id" = $1',
  },
  impact_code: {
    table: 'impact_codes',
    label: 'impact code',
    tenant: '"tenant_id" = $1',
  },
  unit: { table: 'units', label: 'unit', tenant: '"tenant_id" = $1' },
  asset: { table: 'assets', label: 'asset', tenant: '"tenant_id" = $1' },
};

interface ReferenceUse {
  path: string;
  reference: Reference;
  ids: string[];
}

function referenceUses(definition: RuleDefinition): ReferenceUse[] {
  const uses: ReferenceUse[] = [];
  const visit = (list: 'all' | 'any') =>
    (definition.when[list] ?? []).forEach((member, index) => {
      const path = `definition.when.${list}.${index}`;
      const conditions = isCondition(member)
        ? [{ condition: member, path }]
        : (['all', 'any'] as const).flatMap((inner) =>
            (member[inner] ?? []).map((condition, at) => ({
              condition,
              path: `${path}.${inner}.${at}`,
            })),
          );
      for (const { condition, path: conditionPath } of conditions) {
        const reference = fieldSpec(condition.field)?.references;
        if (!reference || condition.value === undefined) continue;
        const values = Array.isArray(condition.value)
          ? condition.value
          : [condition.value];
        uses.push({
          path: `${conditionPath}.value`,
          reference,
          ids: values.map(String),
        });
      }
    });
  visit('all');
  visit('any');
  definition.then.forEach((action, index) => {
    if (isSetAction(action) && action.set === 'impactCodeId') {
      uses.push({
        path: `definition.then.${index}.value`,
        reference: 'impact_code',
        ids: [action.value],
      });
    }
  });
  return uses;
}

/**
 * 422 INVALID_REFERENCE (CONVENTIONS) for any code, unit or asset id of a validated definition that is
 * not a record of the tenant; one query per referenced table, never per id.
 */
export async function assertRuleReferences(
  manager: EntityManager,
  tenantId: string,
  definition: RuleDefinition,
): Promise<void> {
  const uses = referenceUses(definition);
  const byReference = new Map<Reference, Set<string>>();
  for (const use of uses) {
    const ids = byReference.get(use.reference) ?? new Set<string>();
    use.ids.forEach((id) => ids.add(id.toLowerCase()));
    byReference.set(use.reference, ids);
  }
  const known = new Set<string>();
  for (const [reference, ids] of byReference) {
    const lookup = LOOKUPS[reference];
    const rows: Array<{ id: string }> = await manager.query(
      `SELECT "id"::text AS id FROM "${lookup.table}" WHERE ${lookup.tenant} AND "id" = ANY($2::uuid[])`,
      [tenantId, [...ids]],
    );
    rows.forEach((row) => known.add(`${reference}:${row.id}`));
  }
  const missing = uses.find((use) =>
    use.ids.some((id) => !known.has(`${use.reference}:${id.toLowerCase()}`)),
  );
  if (missing)
    throw ruleReferenceInvalid(missing.path, LOOKUPS[missing.reference].label);
}
