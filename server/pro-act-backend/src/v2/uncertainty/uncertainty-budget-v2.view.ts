import { UncertaintyResult } from '../../domain/uncertainty/uncertainty-budget';
import { ReconciliationTolerance } from '../../periods/engine-policy-bodies';
import {
  StoredUncertaintyComponent,
  StoredUncertaintyCorrelation,
  UncertaintyBudget,
} from '../../uncertainty/entities/uncertainty-budget.entity';
import { AdoptedTolerance } from '../../uncertainty/tolerance-adoption.service';
import { ToleranceJustification } from '../../uncertainty/tolerance-justification';
import { computeBudget } from '../../uncertainty/uncertainty-budget-rules';

/** An uncertainty budget as the v2 API returns it (decimals as strings, server-computed values). */
export interface UncertaintyBudgetV2View {
  id: string;
  unitId: string;
  boundary: string;
  uom: string;
  components: StoredUncertaintyComponent[];
  correlations: StoredUncertaintyCorrelation[];
  coverageFactor: string;
  combinedStandardUncertainty: string;
  expandedUncertainty: string;
  /** per component |c·u| and its share of the combined variance (server-computed) */
  contributions: UncertaintyResult['contributions'];
  covarianceTerm: string;
  calibrationRef: string;
  reviewDueAt: string;
  reviewOverdue: boolean;
  evidenceRef: string | null;
  notes: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** approved, effective now (server-decided) */
  inForce: boolean;
  state: string;
  authorId: string;
  decidedBy: string | null;
  decidedAt: string | null;
  /** item 1.3: decided by its own author — the stored SuperAdmin override (owner decision 2026-10-16) */
  selfDecided: boolean;
  decisionReason: string | null;
  createdAt: string;
  rowVersion: number;
}

const iso = (value: Date | null) =>
  value ? new Date(value).toISOString() : null;

export function toUncertaintyBudgetView(
  row: UncertaintyBudget,
  now: Date = new Date(),
): UncertaintyBudgetV2View {
  const computed = computeBudget(row);
  const t = now.getTime();
  const from = new Date(row.effectiveFrom).getTime();
  const to = row.effectiveTo ? new Date(row.effectiveTo).getTime() : null;
  return {
    id: row.id,
    unitId: row.unitId,
    boundary: row.boundary,
    uom: row.uom,
    components: row.components,
    correlations: row.correlations,
    coverageFactor: row.coverageFactor,
    combinedStandardUncertainty: row.combinedStandardUncertainty,
    expandedUncertainty: row.expandedUncertainty,
    contributions: computed.result.contributions,
    covarianceTerm: computed.result.covarianceTerm,
    calibrationRef: row.calibrationRef,
    reviewDueAt: new Date(row.reviewDueAt).toISOString(),
    reviewOverdue: new Date(row.reviewDueAt).getTime() <= t,
    evidenceRef: row.evidenceRef,
    notes: row.notes,
    effectiveFrom: new Date(row.effectiveFrom).toISOString(),
    effectiveTo: iso(row.effectiveTo),
    inForce: row.state === 'approved' && from <= t && (to === null || to > t),
    state: row.state,
    authorId: row.authorId,
    decidedBy: row.decidedBy,
    decidedAt: iso(row.decidedAt),
    selfDecided: row.superAdminOverride,
    decisionReason: row.decisionReason,
    createdAt: new Date(row.createdAt).toISOString(),
    rowVersion: row.rowVersion,
  };
}

/** POST /uncertainty-budgets/preview: the server's numbers for a draft, nothing stored. */
export type UncertaintyPreviewV2View = UncertaintyResult;

/** POST /uncertainty-budgets/{id}/adopt-as-tolerance: the new tolerance version and its justification. */
export interface AdoptedToleranceV2View {
  policyId: string;
  version: number;
  unitId: string;
  effectiveFrom: string;
  tolerance: ReconciliationTolerance;
  justification: ToleranceJustification | null;
}

export function toAdoptedToleranceView(
  adopted: AdoptedTolerance,
): AdoptedToleranceV2View {
  return {
    policyId: adopted.policyId,
    version: adopted.version,
    unitId: adopted.unitId,
    effectiveFrom: adopted.effectiveFrom.toISOString(),
    tolerance: adopted.body,
    justification: adopted.justification,
  };
}
