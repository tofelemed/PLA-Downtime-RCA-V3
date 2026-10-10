import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';
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
} as const;
export type LossTreeMetric = keyof typeof LOSS_TREE_METRICS;

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
    enum: Object.keys(LOSS_TREE_METRICS),
    default: 'qty',
    description:
      'qty = lost quantity per unit of measure; margin / standard_cost / operational_cost = that stored ' +
      'valuation view per reporting currency (never added to each other; unvalued lines never count as zero)',
  })
  @IsOptional()
  @IsIn(Object.keys(LOSS_TREE_METRICS))
  metric?: LossTreeMetric;

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
}

/** `GET /reports/reconciliation-trend`: unaccounted / over-accounted / overproduction per site-local bucket. */
export class ReconciliationTrendQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({ enum: TREND_GROUPS, default: 'day' })
  @IsOptional()
  @IsIn(TREND_GROUPS)
  groupBy?: TrendGroup;
}

/** `GET /reports/reconciliation-status`: workflow state, age and overdue periods of a window. */
export class ReconciliationStatusQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 2160,
    default: 48,
    description:
      'A period not approved this many hours after its end is overdue',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2160)
  overdueAfterHours?: number;

  @ApiPropertyOptional({
    description:
      'Instant the ages are measured at (ISO 8601 with offset); default: now',
  })
  @IsOptional()
  @Matches(INSTANT, { message: `asOf ${INSTANT_MESSAGE}` })
  asOf?: string;
}
