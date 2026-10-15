import { EntityManager } from 'typeorm';
import { defaultValuationBasis } from '../../valuation/valuation-policy.store';

/** The metrics a policy default basis maps to (the same names in the loss-value report and loss tree). */
export type DefaultValueMetric = 'margin' | 'standard_cost' | 'economic_impact';

const METRIC_OF_BASIS: Readonly<Record<string, DefaultValueMetric>> = {
  contribution_margin: 'margin',
  standard_cost: 'standard_cost',
  economic_impact: 'economic_impact',
};

/**
 * SME V8 (14 Oct 2026): the management value view a report opens on — the policy's default basis
 * (`defaultValuationBasis`). Every other view stays selectable; views are never added together.
 */
export async function defaultLossValueMetric(
  manager: EntityManager,
  tenantId: string,
): Promise<DefaultValueMetric> {
  const basis = await defaultValuationBasis(manager, tenantId);
  return METRIC_OF_BASIS[basis] ?? 'margin';
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
