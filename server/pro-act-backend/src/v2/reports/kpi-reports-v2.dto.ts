import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
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

/**
 * Period selection of the downtime reports (Downtime page filters): only the periods of these shifts,
 * crews or products are read (server-side; the stop time of a chosen period counts whole).
 */
export class DowntimeSelectionQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Repeat for several products: only periods with a product slice of one of them (the whole period counts)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Repeat for several shifts: only periods whose shift name (calendar shift label) is one of them',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  shiftNames?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Repeat for several crews: only periods whose shift instance was worked by one of them',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  crewIds?: string[];
}

export class DowntimeReportQueryDto extends DowntimeSelectionQueryDto {
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

/** Groupings a downtime bundle view may use (no `reasonChild`: the Pareto drill uses `/reports/downtime`). */
export const BUNDLE_GROUPS = [
  'reason',
  'reasonLevel1',
  'impact',
  'oee',
  'asset',
  'shift',
  'crew',
  'day',
  'week',
  'month',
] as const;
export type BundleGroup = (typeof BUNDLE_GROUPS)[number];

/** `<groupBy>[:<metric>][:<scheduleClass>]` */
export const BUNDLE_VIEW_PATTERN = new RegExp(
  `^(${BUNDLE_GROUPS.join('|')})(:(${DOWNTIME_METRICS.join('|')}))?(:(${SCHEDULE_CLASSES.join('|')}))?$`,
);
export const MAX_BUNDLE_VIEWS = 12;

/** `GET /reports/downtime-bundle`: several downtime breakdowns read from one run selection (T24). */
export class DowntimeBundleQueryDto extends DowntimeSelectionQueryDto {
  @ApiPropertyOptional({
    enum: SCHEDULE_CLASSES,
    description:
      'The summary of this schedule class only (owner decision 2026-10-19): stop time and stop count of the ' +
      'class (the stored breakdown cells, as the class trend), the class’s own period KPI as stored, every other ' +
      'figure without a value (reason not_by_schedule_class). Omitted: the summary of every class. Views keep ' +
      'their own class token.',
  })
  @IsOptional()
  @IsIn(SCHEDULE_CLASSES)
  scheduleClass?: (typeof SCHEDULE_CLASSES)[number];

  @ApiPropertyOptional({
    default: false,
    description:
      'Include micro-stops (shorter than the oee_policy threshold) in every view; default availability stops only',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  includeMicroStops?: boolean;

  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: MAX_BUNDLE_VIEWS,
    example: ['reasonLevel1', 'asset:frequency', 'day:duration:unplanned'],
    description:
      'Repeat for each view: `<groupBy>[:<metric>][:<scheduleClass>]` with groupBy one of ' +
      `${BUNDLE_GROUPS.join(', ')}; metric duration (default) or frequency; no class = every class. ` +
      'Duplicate tokens are answered once (first kept).',
  })
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BUNDLE_VIEWS)
  @Matches(BUNDLE_VIEW_PATTERN, {
    each: true,
    message:
      'each view must be <groupBy>[:duration|frequency][:planned|unplanned|external|unknown]',
  })
  views: string[] = [];
}
