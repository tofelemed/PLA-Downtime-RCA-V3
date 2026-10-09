import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import {
  toArrayParam,
  toBooleanParam,
} from '../../common/dto/query-param.transformers';
import { INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';

export const OEE_GROUPS = [
  'period',
  'shift',
  'day',
  'week',
  'month',
  'unit',
  'product',
  'crew',
] as const;
export type OeeGroup = (typeof OEE_GROUPS)[number];

export const DOWNTIME_GROUPS = [
  'reason',
  'reasonLevel1',
  'reasonChild',
  'impact',
  'oee',
  'asset',
  'shift',
  'crew',
  'day',
  'week',
  'month',
] as const;
export type DowntimeGroup = (typeof DOWNTIME_GROUPS)[number];

export const OEE_POLICIES = ['operational', 'reconciled'] as const;
export const DOWNTIME_METRICS = ['duration', 'frequency'] as const;
export const SCHEDULE_CLASSES = [
  'planned',
  'unplanned',
  'external',
  'unknown',
] as const;

/** Window, units and run selection shared by the KPI report read models (plan 2.7 step 5). */
export class ReportWindowQueryDto {
  @ApiProperty({
    description:
      'Periods starting at or after this instant (ISO 8601 with offset)',
  })
  @Matches(INSTANT, { message: `from ${INSTANT_MESSAGE}` })
  from: string = '';

  @ApiProperty({
    description:
      'Periods starting before this instant (exclusive); ≤ 400 days after from',
  })
  @Matches(INSTANT, { message: `to ${INSTANT_MESSAGE}` })
  to: string = '';

  @ApiPropertyOptional({
    type: [String],
    description:
      'Repeat for several units; units of the tenant and of the caller’s scope (422 INVALID_REFERENCE). ' +
      'Omitted: every unit the caller may read (a unit-limited caller gets its own units only).',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({
    default: false,
    description:
      'Only approved (published) revisions; default: approved when one exists, else the open draft (provisional)',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  approvedOnly?: boolean;
}

export class OeeReportQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({ enum: OEE_GROUPS, default: 'day' })
  @IsOptional()
  @IsIn(OEE_GROUPS)
  groupBy?: OeeGroup;

  @ApiPropertyOptional({
    enum: OEE_POLICIES,
    default: 'operational',
    description:
      '`reconciled` = the GE-style quantity OEE (labelled), never mixed with operational OEE',
  })
  @IsOptional()
  @IsIn(OEE_POLICIES)
  policy?: (typeof OEE_POLICIES)[number];
}

export class DowntimeReportQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    enum: DOWNTIME_GROUPS,
    default: 'reason',
    description:
      '`reasonChild` = the reason codes one level below `parentReasonId` (Pareto drill-down, plan 3.3)',
  })
  @IsOptional()
  @IsIn(DOWNTIME_GROUPS)
  groupBy?: DowntimeGroup;

  @ApiPropertyOptional({
    enum: DOWNTIME_METRICS,
    default: 'duration',
    description:
      'duration = seconds (allocated, adds up to the union); frequency = stop occurrences starting in the window',
  })
  @IsOptional()
  @IsIn(DOWNTIME_METRICS)
  metric?: (typeof DOWNTIME_METRICS)[number];

  @ApiPropertyOptional({ enum: SCHEDULE_CLASSES })
  @IsOptional()
  @IsIn(SCHEDULE_CLASSES)
  scheduleClass?: (typeof SCHEDULE_CLASSES)[number];

  @ApiPropertyOptional({
    default: false,
    description:
      'Include micro-stops (shorter than the oee_policy threshold); default availability stops only',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  includeMicroStops?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Reason subtree: only cells coded with this reason code or one below it; required with groupBy=reasonChild, ' +
      'allowed with the reason groupings only; a reason code of the tenant (422 INVALID_REFERENCE)',
  })
  @IsOptional()
  @IsUUID()
  parentReasonId?: string;
}

export class ReliabilityReportQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Repeat for several assets; assets of the tenant on units of the caller’s scope (422 INVALID_REFERENCE)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  assetIds?: string[];
}
