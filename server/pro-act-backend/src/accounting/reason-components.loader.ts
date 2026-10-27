import { EntityManager } from 'typeorm';
import { LossEvent } from '../domain/accounting/accounting.types';
import {
  ReasonComponent,
  ReasonComponents,
} from '../domain/accounting/declared.types';

const COMPONENTS: readonly string[] = [
  'availability',
  'performance',
  'quality',
];

const REASON_COMPONENTS_SQL = `SELECT "id", "default_oee_component"::text AS "component"
  FROM "reason_codes" WHERE ("tenant_id" = $1 OR "tenant_id" IS NULL) AND "id" = ANY($2::uuid[]) ORDER BY "id"`;

/** Every reason id an event names: its reason code and each reason of its weighted split. */
export function referencedReasonIds(events: readonly LossEvent[]): string[] {
  const ids = events.flatMap((e) => [
    ...(e.reasonCodeId ? [e.reasonCodeId] : []),
    ...(e.reasonWeights ?? []).map((w) => w.reasonCodeId),
  ]);
  return [...new Set(ids)].sort();
}

function componentOf(value: string | null): ReasonComponent | null {
  return value !== null && COMPONENTS.includes(value)
    ? (value as ReasonComponent)
    : null;
}

/**
 * Declared mode: the default OEE component (`reason_codes.default_oee_component`) of every reason the
 * period's events name, read within the period's tenant (or shared, tenant_id null); `idle`, `none` and
 * unset are null (a line of kind `unaccounted_classified`).
 */
export async function loadReasonComponents(
  manager: EntityManager,
  tenantId: string,
  events: readonly LossEvent[],
): Promise<ReasonComponents> {
  const ids = referencedReasonIds(events);
  if (ids.length === 0) return {};
  const rows: Array<{ id: string; component: string | null }> =
    await manager.query(REASON_COMPONENTS_SQL, [tenantId, ids]);
  return Object.fromEntries(
    rows.map((row) => [row.id, componentOf(row.component)]),
  );
}
