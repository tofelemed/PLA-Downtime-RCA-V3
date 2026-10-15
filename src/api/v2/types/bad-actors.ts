/**
 * CA8 bad-actor review (backend `src/v2/reports/bad-actor-v2.service.ts`, SME 14 Oct 2026). Hand-written:
 * the OpenAPI snapshot describes the query, not the body. Numbers are decimal strings or server counts.
 */
export type BadActorGroupBy = 'asset' | 'failure_mode';
export type BadActorRankBy = 'quantity' | 'value' | 'stops';
export type BadActorTriggerState = 'fired' | 'over_threshold' | 'below' | 'off';

export interface BadActorValueView {
  currency: string;
  /** null when nothing is valued or an exchange rate is missing — never 0 */
  amount: string | null;
  status: 'valued' | 'unvalued' | 'mixed';
  /** SME V7: converted (partly) with a provisional exchange rate */
  fxProvisional: boolean;
}

export interface BadActorTriggerView {
  state: BadActorTriggerState;
  /** largest same-mode unplanned downtime of the asset in the window */
  seconds: number;
  thresholdSeconds: number | null;
  windowDays: number | null;
  criticalAsset: boolean;
  firedAt: string | null;
  rcaId: string | null;
  outcome: string | null;
}

export interface BadActorItemView {
  rank: number;
  key: string;
  assetId: string;
  assetCode: string | null;
  assetName: string | null;
  unitId: string | null;
  /** normalized CA8 identity (`mode:…` / `reason:<id>`) when grouped by failure mode */
  failureMode: string | null;
  stops: number;
  downtimeSeconds: string;
  quantities: Array<{ uom: string | null; quantity: string }>;
  /** approved lost quantity in the report's ranking unit of measure */
  quantity: string | null;
  value: BadActorValueView | null;
  trigger: BadActorTriggerView;
}

export interface BadActorReportView {
  /** `YYYY-MM` in the plant calendar (`calendar`: a Jalali month on a Persian plant) */
  month: string;
  calendar: 'gregorian' | 'persian';
  from: string;
  to: string;
  windowDays: number;
  groupBy: BadActorGroupBy;
  rankBy: BadActorRankBy;
  limit: number;
  /** valuation view of the value column (the policy's default basis, SME V8) */
  view: 'contribution_margin' | 'standard_cost' | 'economic_impact';
  currency: string;
  uom: string | null;
  valuationStatus: 'approved' | 'provisional';
  approvedPeriods: number;
  periods: number;
  basis: string;
  items: BadActorItemView[];
}
