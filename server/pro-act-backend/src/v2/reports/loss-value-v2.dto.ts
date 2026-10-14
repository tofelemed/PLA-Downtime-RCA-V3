import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ReportWindowQueryDto } from './kpi-reports-v2.dto';

/** `metric` → stored valuation view (VAL02: never summed with each other). */
export const LOSS_VALUE_METRICS = {
  margin: 'contribution_margin',
  standard_cost: 'standard_cost',
  operational_cost: 'cost_per_hour',
  independent_components: 'independent_components',
  economic_impact: 'economic_impact',
} as const;
export type LossValueMetric = keyof typeof LOSS_VALUE_METRICS;

export const LOSS_VALUE_GROUPS = ['kind', 'unit', 'day', 'month'] as const;
export type LossValueGroup = (typeof LOSS_VALUE_GROUPS)[number];

export class LossValueReportQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    enum: Object.keys(LOSS_VALUE_METRICS),
    description:
      'margin = commercial opportunity (contribution margin), standard_cost = standard cost view, ' +
      'operational_cost = cost per hour of downtime, independent_components = margin + time cost of the ' +
      'impact codes the policy marks independent, economic_impact = lost contribution on unrecovered sales ' +
      '+ incremental costs (SME V2 / V3). Views are never added to each other. Absent: the default view of ' +
      "the tenant's newest approved valuation policy (SME V8), margin when none is approved.",
  })
  @IsOptional()
  @IsIn(Object.keys(LOSS_VALUE_METRICS))
  metric?: LossValueMetric;

  @ApiPropertyOptional({ enum: ['plan', 'capacity'], default: 'plan' })
  @IsOptional()
  @IsIn(['plan', 'capacity'])
  ledger?: 'plan' | 'capacity';

  @ApiPropertyOptional({
    enum: LOSS_VALUE_GROUPS,
    default: 'kind',
    description:
      'kind keeps every loss kind apart (gains and residuals labelled, never netted); other groupings sum the loss kinds only',
  })
  @IsOptional()
  @IsIn(LOSS_VALUE_GROUPS)
  groupBy?: LossValueGroup;
}
