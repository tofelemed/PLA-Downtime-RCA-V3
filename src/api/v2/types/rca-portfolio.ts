/**
 * Loss → cause → action → outcome portfolio (item 2.1; backend `src/rca-case/portfolio/rca-portfolio.service.ts`,
 * `GET /v2/reports/rca-portfolio`). Hand-written until the OpenAPI types are regenerated. Every count and
 * amount is the server's; approved, claimed and realised figures are never added together.
 */
import type { ApprovedImpactValueView } from './rca';

export type RcaPortfolioCauseKind = 'root' | 'direct' | 'contributing';
export type RcaPortfolioCurrency = 'USD' | 'IRR';

/** A type (not an interface) so it is a valid set of query parameters. */
export type RcaPortfolioQuery = {
  from: string;
  to: string;
  unitIds?: string[];
  causeKind?: RcaPortfolioCauseKind;
  currency?: RcaPortfolioCurrency;
  limit?: number;
};

export interface RcaPortfolioRowView {
  /** the cause code id, or `uncoded` */
  key: string;
  /** null for the Uncoded row */
  causeCode: { id: string; code: string; name: string; active: boolean } | null;
  cases: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
    /** the newest cases of the row */
    sample: Array<{ id: string; title: string; status: string | null }>;
  };
  /** `values` absent without the money capability (left out by the server) */
  approvedLoss: { lines: number; values?: ApprovedImpactValueView[] };
  actions: { total: number; open: number; overdue: number; done: number; cancelled: number };
  effectiveness: { effective: number; notEffective: number; insufficientEvidence: number; pending: number };
  /** absent without the money capability */
  claimedAvoided?: Array<{ currency: string; amount: string; actions: number }>;
  claimsInOtherCurrencies: number;
  /** not money: recurrences or downtime seconds */
  realized: Array<{ metric: 'recurrences' | 'downtime_seconds'; difference: string; cases: number }>;
}

export interface RcaPortfolioView {
  items: RcaPortfolioRowView[];
  nextCursor: string | null;
  window: { from: string; to: string };
  causeKind: RcaPortfolioCauseKind;
  currency: RcaPortfolioCurrency;
  view: 'contribution_margin' | 'standard_cost' | 'economic_impact' | null;
  basis: string | null;
  note: string;
  asOf: string;
}
