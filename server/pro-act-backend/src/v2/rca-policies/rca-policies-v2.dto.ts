import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { COST_CURRENCIES, REPEAT_MATCHES } from '../../domain/rca/rca-policy';

export const RCA_AUTO_CREATE = ['recommend', 'create'] as const;
export const RCA_POLICY_LIMIT_DEFAULT = 20;
export const RCA_POLICY_LIMIT_MAX = 100;

const UNIT_DESCRIPTION =
  'A unit of the tenant and the caller’s scope (422 INVALID_REFERENCE); omitted = the tenant-wide policy';

/** `GET /api/v2/rca-policies/current` */
export class RcaPolicyCurrentQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: UNIT_DESCRIPTION })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

/** `GET /api/v2/rca-policies`: versions of one scope, newest version first. */
export class RcaPolicyListQueryDto extends RcaPolicyCurrentQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor returned as nextCursor by the previous page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: RCA_POLICY_LIMIT_MAX,
    default: RCA_POLICY_LIMIT_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RCA_POLICY_LIMIT_MAX)
  limit: number = RCA_POLICY_LIMIT_DEFAULT;
}

/** D17 critical assets: listed `assets.criticality` values get production thresholds × the factor. */
export class RcaCriticalAssetsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  criticalities!: string[];

  @ApiProperty({
    minimum: 0,
    maximum: 1,
    description: '0.5 = thresholds halved',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  @Max(1)
  thresholdFactor!: number;
}

/** CA8 bad actor: same asset and mode, unplanned downtime summed over a rolling window. */
export class RcaCumulativeDto {
  @ApiProperty({ minimum: 1, maximum: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  windowDays!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  downtimeSeconds!: number;
}

/** D17 safety override markers. */
export class RcaConsequenceDto {
  @ApiProperty({
    type: [String],
    description: 'production_events.sol_type values, e.g. Safety',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  solTypes!: string[];

  @ApiProperty({
    type: [String],
    description: 'production_events.severity values, e.g. Critical',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  severities!: string[];
}

/** `POST /api/v2/rca-policies`: a new approved version of the tenant-wide or one unit's RCA trigger policy. */
export class RcaPolicyCreateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: `${UNIT_DESCRIPTION} (needs a tenant-wide grant, 403 TENANT_SCOPE_REQUIRED)`,
  })
  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @ApiProperty({
    minimum: 0,
    description:
      'Unplanned downtime at or above this many seconds fires the duration trigger; 0 disables it',
  })
  @IsInt()
  @Min(0)
  durationThresholdSeconds!: number;

  @ApiProperty({
    minimum: 1,
    description:
      'Functional failures of one asset within repeatWindowDays that fire the repeat trigger',
  })
  @IsInt()
  @Min(1)
  repeatCount!: number;

  @ApiProperty({ minimum: 1, maximum: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  repeatWindowDays!: number;

  @ApiProperty({
    enum: RCA_AUTO_CREATE,
    description: 'recommend = suggest a case; create = open the case',
  })
  @IsIn(RCA_AUTO_CREATE)
  autoCreate!: (typeof RCA_AUTO_CREATE)[number];

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    description:
      'Approved valued impact at or above this fires the cost trigger; null disables it',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  costThreshold?: number | null;

  @ApiPropertyOptional({
    enum: COST_CURRENCIES,
    nullable: true,
    description:
      'Currency of costThreshold (required with it; finance sets both, D17)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(COST_CURRENCIES)
  costCurrency?: (typeof COST_CURRENCIES)[number] | null;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    maximum: 1,
    description:
      'D17: approved lost quantity of one event at or above this share of the unit daily plan fires (0.01 = 1 %); null off',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  lostQuantityShareOfDailyPlan?: number | null;

  @ApiPropertyOptional({
    enum: REPEAT_MATCHES,
    description:
      'CA8 repeat identity (asset; asset + failure mode; + mechanism)',
  })
  @IsOptional()
  @IsIn(REPEAT_MATCHES)
  repeatMatch?: (typeof REPEAT_MATCHES)[number];

  @ApiPropertyOptional({ type: () => RcaCriticalAssetsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RcaCriticalAssetsDto)
  criticalAssets?: RcaCriticalAssetsDto;

  @ApiPropertyOptional({ type: () => RcaCumulativeDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => RcaCumulativeDto)
  cumulative?: RcaCumulativeDto | null;

  @ApiPropertyOptional({ type: () => RcaConsequenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RcaConsequenceDto)
  consequence?: RcaConsequenceDto;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'CA2/CA3 effectiveness rules: baselineLookbackDays, minExposureHours, requiredReduction, reviewDays, zeroRepeatClasses and ' +
      'minimumCoverage (0–1, default 0.95: state-data coverage of the window after an action needed for a verdict; a version ' +
      'without it behaves as 0.95) (contracts/policies/rca_policy.schema.json; checked by the server parser, 422 INVALID_POLICY)',
  })
  @IsOptional()
  @IsObject()
  effectiveness?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'CA5 FMEA rules: method, rpnThreshold, severityReview, priorityRules',
  })
  @IsOptional()
  @IsObject()
  fmea?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'CA6 5-Why rules: guidelineLevels, minLevels, evidencePerLevel, unsupportedRootCauses',
  })
  @IsOptional()
  @IsObject()
  fiveWhy?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'CA7 investigation tiers per consequence class: methodGroups, minTeamMembers',
  })
  @IsOptional()
  @IsObject()
  investigation?: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
