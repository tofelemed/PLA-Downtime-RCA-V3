import type { BodyOf } from '../schema-types';
import type { ToleranceJustificationView } from './reconciliation';

/** SME E4 uncertainty budgets (backend `src/v2/uncertainty/uncertainty-budget-v2.view.ts`); decimals as strings. */
export interface UncertaintyComponentView {
  kind: string;
  label: string;
  standardUncertainty: string;
  sensitivity: string;
}

export interface UncertaintyContributionView {
  index: number;
  kind: string;
  label: string;
  contribution: string;
  shareOfVariance: string | null;
}

/** The server's numbers of a budget (preview or stored). */
export interface UncertaintyResultView {
  combinedVariance: string;
  covarianceTerm: string;
  combinedStandardUncertainty: string;
  coverageFactor: string;
  expandedUncertainty: string;
  contributions: UncertaintyContributionView[];
}

export interface UncertaintyBudgetView {
  id: string;
  unitId: string;
  boundary: string;
  uom: string;
  components: UncertaintyComponentView[];
  correlations: Array<{ a: number; b: number; coefficient: string }>;
  coverageFactor: string;
  combinedStandardUncertainty: string;
  expandedUncertainty: string;
  contributions: UncertaintyContributionView[];
  covarianceTerm: string;
  calibrationRef: string;
  reviewDueAt: string;
  reviewOverdue: boolean;
  evidenceRef: string | null;
  notes: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  inForce: boolean;
  /** proposed | approved | rejected */
  state: string;
  authorId: string;
  decidedBy: string | null;
  decidedAt: string | null;
  /** item 1.3: server-derived SuperAdmin self-decision (owner decision 2026-10-16); absent from older servers */
  selfDecided?: boolean;
  decisionReason: string | null;
  createdAt: string;
  rowVersion: number;
}

export interface AdoptedToleranceView {
  policyId: string;
  version: number;
  unitId: string;
  effectiveFrom: string;
  tolerance: { mode: string; value: number; uncertaintyBudgetId?: string };
  justification: ToleranceJustificationView | null;
}

export type UncertaintyBudgetCreateBody = BodyOf<'/api/v2/uncertainty-budgets', 'post'>;
export type UncertaintyPreviewBody = BodyOf<'/api/v2/uncertainty-budgets/preview', 'post'>;
