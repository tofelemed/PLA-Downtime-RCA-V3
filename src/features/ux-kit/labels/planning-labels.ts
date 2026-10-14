import type { CalendarWarningCode, ExclusionKind, HolidayTreatment } from '@/api/v2/types/calendars';
import type { ApprovalState, Distribution, PlanBasis, SliceStream } from '@/api/v2/types/plans';
import type { CapacityModel, RateKind, RateTimebase, ValuationBasis, VersionState } from '@/api/v2/types/profiles';
import type {
  DefaultBasis,
  DemandRule,
  DemandStatusValue,
  FxDateRule,
  FxPolicy,
  FxRateType,
  QualityDisposition,
  TimeBasisRule,
} from '@/api/v2/types/valuation';

/**
 * Labels of plans, profiles, calendars and valuation policies (plan 3.4). Basis and distribution wording
 * follows `plans-profiles-calendars/plans/plan-form-dialog.tsx`.
 */
export type AnyVersionState = ApprovalState | VersionState;

/** Every version state (plans: draft → submitted → approved → superseded; profiles: … → retired). */
export const VERSION_STATE_LABELS: Readonly<Record<AnyVersionState, string>> = {
  draft: 'Draft',
  submitted: 'Submitted for approval',
  approved: 'Approved',
  superseded: 'Superseded',
  retired: 'Retired',
};

/** Short basis name, e.g. in a summary line. */
export const BASIS_SHORT_LABELS: Readonly<Record<PlanBasis, string>> = {
  time: 'Time-based',
  quantity: 'Quantity-based',
  manual: 'Manual targets',
};

/** Basis with its meaning, e.g. in a picker. */
export const BASIS_LABELS: Readonly<Record<PlanBasis, string>> = {
  time: 'Time — schedule × planning rate',
  quantity: 'Quantity — header target distributed',
  manual: 'Manual — per-shift targets',
};

export const DISTRIBUTION_LABELS: Readonly<Record<Distribution, string>> = {
  scheduled_capacity: 'Proportional to scheduled planning capacity',
  explicit_weights: 'Explicit slice weights',
  equal: 'Equal per eligible shift',
};

export const SLICE_STREAM_LABELS: Readonly<Record<SliceStream, string>> = {
  sequential: 'One after another',
  independent: 'Independent streams',
  shared: 'Shared capacity',
};

export const RATE_KIND_LABELS: Readonly<Record<RateKind, string>> = {
  nameplate: 'Nameplate',
  demonstrated: 'Demonstrated',
  sustained: 'Sustained',
  planning: 'Planning',
  budget: 'Budget',
  forecast: 'Forecast',
};

export const RATE_TIMEBASE_LABELS: Readonly<Record<RateTimebase, string>> = {
  s: 'per second',
  min: 'per minute',
  h: 'per hour',
  d: 'per day',
};

export const CAPACITY_MODEL_LABELS: Readonly<Record<CapacityModel, string>> = {
  single_stream: 'Single stream',
  shared_capacity: 'Shared capacity',
  independent_streams: 'Independent streams',
};

export const VALUATION_BASIS_LABELS: Readonly<Record<ValuationBasis, string>> = {
  contribution_margin: 'Contribution margin',
  standard_cost: 'Standard cost',
  cost_per_hour: 'Cost per hour of downtime',
  variable_cost: 'Variable production cost (scrap)',
  salvage_value: 'Salvage value (scrap)',
  disposal_cost: 'Disposal / handling cost',
  downgrade_price_difference: 'Downgrade price difference',
  rework_cost: 'Rework cost',
};

export const DEFAULT_BASIS_LABELS: Readonly<Record<DefaultBasis, string>> = {
  contribution_margin: 'Contribution margin',
  standard_cost: 'Standard cost',
  economic_impact: 'Economic impact (lost sales + incremental costs)',
};

export const FX_RATE_TYPE_LABELS: Readonly<Record<FxRateType, string>> = {
  economic: 'Economic (treasury conversion basis)',
  group_reporting: 'Group reporting (translation policy)',
  budget: 'Budget / constant currency',
};

export const FX_DATE_RULE_LABELS: Readonly<Record<FxDateRule, string>> = {
  event_date: 'Rate of each loss date, summed into the month',
  period_average: 'Average rate of the month',
};

export const DEMAND_RULE_LABELS: Readonly<Record<DemandRule, string>> = {
  demand_constrained_only: 'Lost sale only when the product was sold out',
  all_lost_output: 'Every lost tonne is a lost sale',
};

export const QUALITY_DISPOSITION_LABELS: Readonly<Record<QualityDisposition, string>> = {
  scrap: 'Scrap',
  downgrade: 'Downgrade (sold off-grade)',
  rework: 'Rework (recovered)',
};

export const DEMAND_STATUS_LABELS: Readonly<Record<DemandStatusValue, string>> = {
  demand_constrained: 'Sold out (demand constrained)',
  not_constrained: 'Not constrained (inventory covers demand)',
};

export const TIME_BASIS_RULE_LABELS: Readonly<Record<TimeBasisRule, string>> = {
  exclusive: 'Each hour counted once',
  independent_components: 'Each component counted on its own',
};

export const FX_POLICY_LABELS: Readonly<Record<FxPolicy, string>> = {
  none: 'No currency conversion',
  snapshot: 'Rate of the day (snapshot)',
};

export const EXCLUSION_KIND_LABELS: Readonly<Record<ExclusionKind, string>> = {
  planned_shutdown: 'Planned shutdown',
  turnaround: 'Turnaround',
  no_demand: 'No demand',
};

export const HOLIDAY_TREATMENT_LABELS: Readonly<Record<HolidayTreatment, string>> = {
  excluded: 'No production',
  reduced: 'Reduced hours',
};

export const CALENDAR_WARNING_LABELS: Readonly<Record<CalendarWarningCode, string>> = {
  dst_gap: 'Clock change skips this time',
  dst_repeat: 'Clock change repeats this time',
  dst_split: 'Shift split by a clock change',
  holiday_reduced: 'Holiday with reduced hours',
  crew_conflict: 'Crew assigned twice',
  timezone_fallback: 'Plant time zone not set (UTC used)',
};
