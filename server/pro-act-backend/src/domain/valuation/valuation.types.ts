import { LossKind } from '../accounting/accounting.types';
import { Dec } from '../actuals/decimal';
import { ValuationBasis } from '../profiles/profile.types';

/**
 * The three monetary views of VAL01 / VAL02. Each line is valued on every view that applies to it, and the
 * views are always reported as separate totals (never added: lost margin already contains the time cost):
 * `contribution_margin` = commercial opportunity (default view), `standard_cost` = standard cost view,
 * `cost_per_hour` = operational (time) cost of downtime.
 */
export const VALUATION_VIEWS = [
  'contribution_margin',
  'standard_cost',
  'cost_per_hour',
] as const;
export type ValuationView = (typeof VALUATION_VIEWS)[number];

/** Totals-only view: margin + time cost of impact codes the policy marks as independent cost components. */
export const INDEPENDENT_VIEW = 'independent_components';
export type TotalsView = ValuationView | typeof INDEPENDENT_VIEW;

export const VIEW_LABELS: Readonly<Record<TotalsView, string>> = {
  contribution_margin: 'Commercial opportunity (contribution margin)',
  standard_cost: 'Standard cost view',
  cost_per_hour: 'Operational cost (cost per hour)',
  independent_components:
    'Margin + time cost of independent cost components only',
};

export const VALUATION_ENGINE_VERSION = '2.6.0';

/** `valuation_basis` policy as the engine applies it (the version recorded on the run). */
export interface ValuationPolicySnapshot {
  id: string | null;
  version: number | null;
  /** finance approval recorded (VAL01); unapproved → every line `unvalued`, reason `policy_unapproved` */
  approved: boolean;
  defaultBasis: 'contribution_margin' | 'standard_cost';
  timeBasisRule: 'exclusive' | 'independent_components';
  /** reporting currencies (D08: IRR and USD); every valued line is reported in each of them */
  currencies: string[];
  fxPolicy: 'none' | 'snapshot';
  independentImpactCodeIds: string[];
}

/** An approved valuation rate version as frozen into a run (values copied, so later closes do not matter). */
export interface ValuationRateSnapshot {
  id: string;
  version: number;
  /** profile id (margin / standard cost) or impact code id (cost per hour) */
  ownerId: string;
  basis: ValuationBasis;
  value: string;
  currency: string;
  perUom: string;
  from: string;
  to: string | null;
}

/** An approved FX rate version: 1 `fromCurrency` = `rate` `toCurrency` over `[from, to)`. */
export interface FxRateSnapshot {
  id: string;
  version: number;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  from: string;
  to: string | null;
}

/** Everything valuation reads, frozen per calculation run and part of its input hash (FND03, VAL03). */
export interface ValuationContext {
  engineVersion: string;
  policy: ValuationPolicySnapshot;
  rates: ValuationRateSnapshot[];
  fx: FxRateSnapshot[];
}

/** What valuation needs to know about one loss line. */
export interface ValuationLineInput {
  kind: LossKind;
  quantity: Dec;
  uom: string | null;
  start: Date;
  end: Date;
  /** lost seconds for time-based lines (availability with a cause); null = no time basis */
  seconds: Dec | null;
  profileId: string | null;
  impactCodeId: string | null;
}

/** One rate version applied to (a time share of) a line. */
export interface ValuationComponent {
  rateVersionId: string;
  rateVersion: number;
  from: Date;
  to: Date;
  currency: string;
  unitValue: string;
  quantity: Dec | null;
  seconds: Dec | null;
  amount: Dec;
}

export interface CurrencyAmount {
  currency: string;
  /** null when unvalued or when no approved FX rate covers a component's date (never estimated) */
  amount: Dec | null;
  reason: string | null;
  fxRateIds: string[];
  /** true when every component was priced in this currency (no conversion) */
  native: boolean;
}

export interface LineViewValuation {
  view: ValuationView;
  status: 'valued' | 'unvalued';
  reason: string | null;
  components: ValuationComponent[];
  amounts: CurrencyAmount[];
}

export interface LineValuation {
  valuationDate: Date;
  seconds: Dec | null;
  views: LineViewValuation[];
}
