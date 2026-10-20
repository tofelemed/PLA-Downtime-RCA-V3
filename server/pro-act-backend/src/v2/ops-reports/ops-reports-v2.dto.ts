import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ReportWindowQueryDto } from '../reports/kpi-reports-v2.dto';

export const PRODUCTION_GROUPS = [
  'total',
  'day',
  'week',
  'month',
  'unit',
] as const;
export type ProductionGroup = (typeof PRODUCTION_GROUPS)[number];

/** `GET /reports/production-by-product` (R1, R11): output, quality classes and plan per product. */
export class ProductionByProductQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    enum: PRODUCTION_GROUPS,
    default: 'total',
    description:
      'Rows per product and this group: the window (`total`), the plant day, week or month, or the unit',
  })
  @IsOptional()
  @IsIn(PRODUCTION_GROUPS)
  groupBy?: ProductionGroup;
}

/** `GET /reports/event-status` (R1, R2, R9): coding and verification state of the window's events. */
export class EventStatusQueryDto extends ReportWindowQueryDto {}
