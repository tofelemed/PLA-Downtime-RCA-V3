/**
 * Recurring-cause report (item 1.1; backend `src/rca-case/rca-cause-report.service.ts`). Hand-written: the
 * OpenAPI snapshot describes the query, not the body. Counts and amounts are the server's, never summed here.
 */
import type { QueryOf } from '../schema-types';
import type { ApprovedImpactValueView } from './rca';

export type RcaCauseReportQuery = QueryOf<'/api/v2/reports/rca-causes', 'get'>;
export type RcaCauseReportSort = NonNullable<RcaCauseReportQuery['sort']>;

/** One catalogue cause, in the server's rank order. */
export interface RcaCauseReportItemView {
  causeCodeId: string;
  code: string;
  name: string;
  /** false once the code was retired (its cases still count) */
  active: boolean;
  /** cases of your scope with at least one cause of this code */
  cases: number;
  causes: number;
  /** approved loss of the events and loss lines linked to those cases; `values` absent without the money capability */
  approvedLoss: { lines: number; values?: ApprovedImpactValueView[] };
}

export interface RcaCauseReportView {
  items: RcaCauseReportItemView[];
  /** valuation view of the amounts (the policy default); null when nothing was ranked */
  view: 'contribution_margin' | 'standard_cost' | 'economic_impact' | null;
  basis: string | null;
  asOf: string;
}
