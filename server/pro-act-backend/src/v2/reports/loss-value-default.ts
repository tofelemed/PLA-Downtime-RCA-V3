import { EntityManager } from 'typeorm';
import { LossValueMetric } from './loss-value-v2.dto';

const METRIC_OF_BASIS: Readonly<Record<string, LossValueMetric>> = {
  contribution_margin: 'margin',
  standard_cost: 'standard_cost',
  economic_impact: 'economic_impact',
};

/**
 * SME V8 (14 Oct 2026): the management value view a report opens on — the default basis of the tenant's
 * newest approved tenant-wide valuation policy in force (the economic view from version 3); contribution
 * margin while none is approved. Every other view stays selectable; views are never added together.
 */
export async function defaultLossValueMetric(
  manager: EntityManager,
  tenantId: string,
): Promise<LossValueMetric> {
  const [row] = await manager.query<Array<{ basis: string | null }>>(
    `SELECT "body"->>'defaultBasis' AS "basis" FROM "accounting_policies"
      WHERE "tenant_id" = $1 AND "policy_kind" = 'valuation_basis' AND "scope_key" = 'tenant'
        AND "approved_at" IS NOT NULL AND "effective_from" <= now()
      ORDER BY "version" DESC LIMIT 1`,
    [tenantId],
  );
  return METRIC_OF_BASIS[row?.basis ?? ''] ?? 'margin';
}

/** SME V8 / R12: figures are `approved` only when every shown period is; otherwise provisional. */
export function valuationStatusOf(stats: {
  periods: number;
  approved: number;
}): 'approved' | 'provisional' {
  return stats.periods > 0 && stats.approved === stats.periods
    ? 'approved'
    : 'provisional';
}
