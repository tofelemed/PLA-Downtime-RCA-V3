import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';
import { EnumArrayParam } from '../common/enum-array-param';
import { ReportWindowQueryDto } from '../reports/kpi-reports-v2.dto';

export const LEDGERS = ['plan', 'capacity'] as const;
export type Ledger = (typeof LEDGERS)[number];

export const LOSS_TREE_GROUPS = [
  'reason',
  'impact',
  'oee',
  'kind',
  'unit',
] as const;
export type LossTreeGroup = (typeof LOSS_TREE_GROUPS)[number];

/** `qty` = quantity per unit of measure; the others = one stored valuation view per currency (VAL02). */
export const LOSS_TREE_METRICS = {
  qty: null,
  margin: 'contribution_margin',
  standard_cost: 'standard_cost',
  operational_cost: 'cost_per_hour',
  economic_impact: 'economic_impact',
} as const;
export type LossTreeMetric = keyof typeof LOSS_TREE_METRICS;

/** SME V8: `value` = the default management view of the tenant's approved valuation policy. */
export const LOSS_TREE_METRIC_PARAMS = [
  ...Object.keys(LOSS_TREE_METRICS),
  'value',
] as const;
export type LossTreeMetricParam = LossTreeMetric | 'value';

/**
 * Loss kinds of the tree: what lowers output (gains, residuals, tolerance adjustments and SME R9 reversals
 * — corrections of an earlier period, shown on the period — stay apart).
 */
export const LOSS_TREE_KINDS = [
  'schedule_exclusion',
  'availability',
  'performance',
  'quality',
  'transition_allowance',
  'transition_excess',
  'bridge',
  'unaccounted_classified',
] as const;
export type LossTreeKind = (typeof LOSS_TREE_KINDS)[number];

export const TREND_GROUPS = ['shift', 'day', 'week', 'month'] as const;
export type TrendGroup = (typeof TREND_GROUPS)[number];

/** `GET /reports/scope-waterfall`: the ledger waterfall of every period of a window and units (plan 3.6). */
export class ScopeWaterfallQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({ enum: LEDGERS, default: 'plan' })
  @IsOptional()
  @IsIn(LEDGERS)
  ledger?: Ledger;
}

/** `GET /reports/loss-tree`: calculation-run loss lines per reason, impact, OEE component, kind or unit. */
export class LossTreeQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({ enum: LOSS_TREE_GROUPS, default: 'reason' })
  @IsOptional()
  @IsIn(LOSS_TREE_GROUPS)
  groupBy?: LossTreeGroup;

  @ApiPropertyOptional({
    enum: LOSS_TREE_METRIC_PARAMS,
    default: 'qty',
    description:
      'qty = lost quantity per unit of measure; margin / standard_cost / operational_cost / economic_impact = ' +
      'that stored valuation view per reporting currency (never added to each other; unvalued lines never ' +
      'count as zero); value = the default view of the approved valuation policy (SME V8, economic impact ' +
      'from policy version 3; contribution margin while none is approved)',
  })
  @IsOptional()
  @IsIn(LOSS_TREE_METRIC_PARAMS)
  metric?: LossTreeMetricParam;

  @ApiPropertyOptional({ enum: LEDGERS, default: 'plan' })
  @IsOptional()
  @IsIn(LEDGERS)
  ledger?: Ledger;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    description:
      'Largest groups per unit / currency only (top opportunities); totals always cover every group',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** only these loss kinds (FE-08: availability = losses of stops); every kind of the tree when absent */
  @EnumArrayParam(LOSS_TREE_KINDS)
  kinds?: LossTreeKind[];
}

/** `GET /reports/reconciliation-trend`: unaccounted / over-accounted / overproduction per site-local bucket. */
export class ReconciliationTrendQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({ enum: TREND_GROUPS, default: 'day' })
  @IsOptional()
  @IsIn(TREND_GROUPS)
  groupBy?: TrendGroup;
}

/**
 * `GET /reports/reconciliation-status`: workflow state, age and overdue periods of a window. Overdue follows
 * the plant's `reconciliation_sla` policy (SME R3), no longer a query parameter.
 */
export class ReconciliationStatusQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    description:
      'Instant the ages are measured at (ISO 8601 with offset); default: now',
  })
  @IsOptional()
  @Matches(INSTANT, { message: `asOf ${INSTANT_MESSAGE}` })
  asOf?: string;
}
