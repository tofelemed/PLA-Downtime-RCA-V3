import { EntityManager } from 'typeorm';
import { Dec } from '../domain/actuals/decimal';
import { ReconciliationTolerance } from '../periods/engine-policy-bodies';
import { UncertaintyBudget } from './entities/uncertainty-budget.entity';

/**
 * SME E4: why an absolute reconciliation tolerance has its size — the uncertainty budget it references,
 * its expanded uncertainty and evidence, whether the tolerance value still equals that expanded
 * uncertainty and whether the budget's review is overdue. `found` false = the referenced budget is not
 * the tenant's (never expected; shown rather than hidden).
 */
export interface ToleranceJustification {
  budgetId: string;
  found: boolean;
  unitId: string | null;
  boundary: string | null;
  uom: string | null;
  combinedStandardUncertainty: string | null;
  coverageFactor: string | null;
  expandedUncertainty: string | null;
  calibrationRef: string | null;
  reviewDueAt: string | null;
  reviewOverdue: boolean;
  valueMatchesExpandedUncertainty: boolean;
}

export async function toleranceJustification(
  manager: EntityManager,
  tenantId: string,
  tolerance: ReconciliationTolerance,
  now: Date = new Date(),
): Promise<ToleranceJustification | null> {
  const budgetId = tolerance.uncertaintyBudgetId;
  if (!budgetId) return null;
  const budget = await manager.findOneBy(UncertaintyBudget, {
    id: budgetId,
    tenantId,
  });
  if (!budget) {
    return {
      budgetId,
      found: false,
      unitId: null,
      boundary: null,
      uom: null,
      combinedStandardUncertainty: null,
      coverageFactor: null,
      expandedUncertainty: null,
      calibrationRef: null,
      reviewDueAt: null,
      reviewOverdue: false,
      valueMatchesExpandedUncertainty: false,
    };
  }
  return {
    budgetId,
    found: true,
    unitId: budget.unitId,
    boundary: budget.boundary,
    uom: budget.uom,
    combinedStandardUncertainty: budget.combinedStandardUncertainty,
    coverageFactor: budget.coverageFactor,
    expandedUncertainty: budget.expandedUncertainty,
    calibrationRef: budget.calibrationRef,
    reviewDueAt: new Date(budget.reviewDueAt).toISOString(),
    reviewOverdue: new Date(budget.reviewDueAt).getTime() <= now.getTime(),
    valueMatchesExpandedUncertainty: new Dec(tolerance.value).eq(
      budget.expandedUncertainty,
    ),
  };
}
