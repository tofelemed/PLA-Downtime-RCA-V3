import { LossKind } from '../accounting/accounting.types';
import { RateTimebase } from '../actuals/actuals.types';
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
  'economic_impact',
] as const;
export type ValuationView = (typeof VALUATION_VIEWS)[number];

/** Totals-only view: margin + time cost of impact codes the policy marks as independent cost components. */
export const INDEPENDENT_VIEW = 'independent_components';
export type TotalsView = ValuationView | typeof INDEPENDENT_VIEW;

export const VIEW_LABELS: Readonly<Record<TotalsView, string>> = {
  contribution_margin: 'Commercial opportunity (contribution margin)',
  standard_cost: 'Standard cost view',
  cost_per_hour: 'Operational cost (cost per hour)',
  economic_impact:
    'Economic impact (lost contribution on unrecovered sales + incremental costs)',
  independent_components:
    'Margin + time cost of independent cost components only',
};

/**
 * 2.8.1: SME R9 — a reversal line carries the reversed line's approved value with the opposite sign (same
 * views, currencies and FX as approved), never re-priced (`reversal-valuation.ts`).
 * 2.8.0: SME V2 remainder — yield loss on rework (lost share valued like scrap; recorded recovery
 * movements first, the approved rework yield only where recovery is not recorded) and the contribution
 * displaced at a demand-constrained unit by rework time. 2.7.0: SME V7 provisional FX rates and the E3
 * line quality-class disposition.
 */
export const VALUATION_ENGINE_VERSION = '2.8.1';

/** SME V5: FX rate tables per purpose (never a market label such as "NIMA"; the source says where from). */
export const FX_RATE_TYPES = ['economic', 'group_reporting', 'budget'] as const;
export type FxRateType = (typeof FX_RATE_TYPES)[number];

/** SME V6: event-date rate (default) or the average of the rates over the period's local month. */
export const FX_DATE_RULES = ['event_date', 'period_average'] as const;
export type FxDateRule = (typeof FX_DATE_RULES)[number];

/** Policy v3 FX rule (V5 / V6); absent on v1 / v2 bodies, which use the `economic` table at the event date. */
export interface FxRule {
  rateType: FxRateType;
  dateRule: FxDateRule;
  /** period_average only: an average is refused when a rate in the month deviates more (ratio, e.g. 0.05) */
  maxAverageDeviation: string | null;
}

/** SME V2 / E3: what happened to quality-loss tonnes. */
export const QUALITY_DISPOSITIONS = ['scrap', 'downgrade', 'rework'] as const;
export type QualityDisposition = (typeof QUALITY_DISPOSITIONS)[number];

/** SME V3: lost output is lost contribution only when demand was constrained (sold out), or always. */
export const DEMAND_RULES = [
  'demand_constrained_only',
  'all_lost_output',
] as const;
export type DemandRule = (typeof DEMAND_RULES)[number];

/** Policy v3 rules of the `economic_impact` view (SME V2–V4, V8); absent on v1 / v2 bodies. */
export interface EconomicRules {
  demandRule: DemandRule;
  /** impact code id → disposition of the quality loss it names */
  qualityDispositions: Readonly<Record<string, QualityDisposition>>;
  /** disposition of quality lines without a mapped impact code; null = such lines stay unvalued */
  defaultQualityDisposition: QualityDisposition | null;
  /** V4: manual availability lines get a cost-per-hour value from the hours of their evidenced events */
  manualLineHours: boolean;
}

export type DefaultBasis =
  | 'contribution_margin'
  | 'standard_cost'
  | 'economic_impact';

/** `valuation_basis` policy as the engine applies it (the version recorded on the run). */
export interface ValuationPolicySnapshot {
  id: string | null;
  version: number | null;
  /** finance approval recorded (VAL01); unapproved → every line `unvalued`, reason `policy_unapproved` */
  approved: boolean;
  defaultBasis: DefaultBasis;
  timeBasisRule: 'exclusive' | 'independent_components';
  /** reporting currencies (D08: IRR and USD); every valued line is reported in each of them */
  currencies: string[];
  fxPolicy: 'none' | 'snapshot';
  independentImpactCodeIds: string[];
  /** v3 only (kept off older snapshots so their run hashes are unchanged) */
  fx?: FxRule;
  economic?: EconomicRules;
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
  /** SME V7: an authorised provisional rate (written only when true, so older run hashes are unchanged) */
  provisional?: true;
}

/** SME V3: an approved demand status of a product over `[from, to)` (sold out = demand constrained). */
export interface DemandStatusSnapshot {
  id: string;
  version: number;
  productId: string;
  constrained: boolean;
  from: string;
  to: string | null;
}

/** SME V2 / E3: an approved recovery movement of a rework lot (the reprocessing interval and its output). */
export interface ReworkRecoverySnapshot {
  id: string;
  start: string;
  end: string;
  /** recovered saleable quantity, in the lot's unit */
  quantity: string;
  /** reprocessed material passed the recovery unit's production boundary again */
  remeasured: boolean;
  /** reprocessed on the rework lot's own unit (only then does it use that unit's capacity) */
  sameUnit: boolean;
}

/** SME V2 / E3: an approved rework lot disposition of the period's unit with its approved recoveries. */
export interface ReworkLotSnapshot {
  id: string;
  productId: string;
  /** production interval of the defective lot, half-open */
  start: string;
  end: string;
  quantity: string;
  uom: string;
  recoveries: ReworkRecoverySnapshot[];
}

/** An approved `rework_yield` valuation rate of a profile: recovered tonnes per reworked tonne (0 < value ≤ 1). */
export interface ReworkYieldSnapshot {
  id: string;
  version: number;
  profileId: string;
  value: string;
  from: string;
  to: string | null;
}

/** An approved planning rate version of a profile (displaced output = rework time × this rate). */
export interface PlannedRateSnapshot {
  id: string;
  version: number;
  profileId: string;
  rate: string;
  timebase: RateTimebase;
  from: string;
  to: string | null;
}

/** Everything valuation reads, frozen per calculation run and part of its input hash (FND03, VAL03). */
export interface ValuationContext {
  engineVersion: string;
  policy: ValuationPolicySnapshot;
  rates: ValuationRateSnapshot[];
  fx: FxRateSnapshot[];
  /** v3 economic view only: approved demand statuses of the period's products */
  demand?: DemandStatusSnapshot[];
  /** v3 `period_average` only: the local month whose average rate converts every line of the period */
  fxAverage?: { from: string; to: string };
  /** v3 economic view only (2.8.0): approved rework lots of the unit overlapping the period, with recoveries */
  reworkLots?: ReworkLotSnapshot[];
  /** v3 economic view only (2.8.0): approved rework yields of the slices' profiles (never in `rates`: no currency) */
  reworkYields?: ReworkYieldSnapshot[];
  /** v3 economic view only (2.8.0): approved planning rates of the slices' profiles */
  plannedRates?: PlannedRateSnapshot[];
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
  /** product of the slice (demand status, SME V3); absent outside the economic view */
  productId?: string | null;
  /** SME E3: disposition class of a quality line (`quality_class:*` flag); absent = unclassified */
  qualityClass?: string | null;
}

/** Economic-view parts (SME V2): non-overlapping, so they add up to the line's economic impact. */
export type EconomicComponent =
  | 'lost_contribution'
  | 'variable_cost'
  | 'salvage'
  | 'disposal'
  | 'price_difference'
  | 'rework_cost'
  /** SME V2 yield loss on rework: the reworked share not recovered, valued like scrap (2.8.0) */
  | 'yield_loss_contribution'
  | 'yield_loss_variable_cost'
  | 'yield_loss_salvage'
  | 'yield_loss_disposal'
  /** SME V2: contribution of prime output displaced by rework time at a demand-constrained unit (2.8.0) */
  | 'displaced_contribution';

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
  /** economic view only: which part of the impact this is (salvage is negative) */
  component?: EconomicComponent;
}

export interface CurrencyAmount {
  currency: string;
  /** null when unvalued or when no approved FX rate covers a component's date (never estimated) */
  amount: Dec | null;
  reason: string | null;
  fxRateIds: string[];
  /** true when every component was priced in this currency (no conversion) */
  native: boolean;
  /** SME V7: converted with an authorised provisional FX rate (present only when true) */
  provisional?: true;
}

export interface LineViewValuation {
  view: ValuationView;
  status: 'valued' | 'unvalued';
  reason: string | null;
  components: ValuationComponent[];
  amounts: CurrencyAmount[];
  /** economic view only: the demand status applied (SME V3) */
  demandStatusId?: string;
  /** economic view only: assumptions shown with the value, e.g. `demand_not_constrained`, `disposition_scrap` */
  notes?: string[];
}

export interface LineValuation {
  valuationDate: Date;
  seconds: Dec | null;
  views: LineViewValuation[];
}
