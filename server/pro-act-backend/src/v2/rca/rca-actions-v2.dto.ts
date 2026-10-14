import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  BASELINE_METRICS,
  BaselineMetric,
} from '../../domain/rca/rca-verification';
import {
  RCA_ACTION_STATUSES,
  RCA_ACTION_TYPES,
  RcaActionStatus,
  RcaActionType,
} from '../../rca/entities/rca-action.entity';

const DECIMAL = /^\d{1,16}(\.\d{1,8})?$/;
export const CLAIM_CURRENCIES = ['IRR', 'USD'] as const;

export class RcaActionBaselineDto {
  @ApiProperty({ enum: BASELINE_METRICS })
  @IsIn(BASELINE_METRICS)
  metric: BaselineMetric;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 365,
    description:
      'Lookback in days before the verification window; omitted = the policy lookback (CA3: 90)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  windowDays?: number;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Refused since CA3 (422 BASELINE_DECLARED): the server computes the baseline from history; propose a correction instead',
  })
  @IsOptional()
  @IsString()
  value?: string;
}

/** A file attached to the case that proves an action was done (CA4). */
export class RcaCompletionAttachmentDto {
  @ApiProperty({
    maxLength: 255,
    description: 'fileName returned by the case attachment upload',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}

/** CA3: a proposed correction of the computed baseline (another person approves it). */
export class RcaBaselineCorrectionDto {
  @ApiProperty({
    description:
      'Corrected metric value over the same exposure (decimal string)',
  })
  @IsString()
  @Matches(DECIMAL)
  value: string;

  @ApiProperty({
    minLength: 10,
    maxLength: 2000,
    description: 'Why the counted data is wrong',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;
}

/** CA3: the independent decision on a proposed correction. */
export class RcaBaselineDecisionDto {
  @ApiProperty()
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/** An RCA action (RCA03): owner, due date, status, completion evidence, verification window, baseline. */
export class RcaActionV2CreateDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 4000 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  ownerId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  dueDate?: string | null;

  @ApiPropertyOptional({
    enum: RCA_ACTION_STATUSES,
    description: 'open when omitted',
  })
  @IsOptional()
  @IsIn(RCA_ACTION_STATUSES)
  status?: RcaActionStatus;

  @ApiPropertyOptional({
    enum: RCA_ACTION_TYPES,
    nullable: true,
    description:
      'CA4: what kind of action (decides the evidence expected); required to mark it done',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(RCA_ACTION_TYPES)
  actionType?: RcaActionType | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'CA4 completion date (defaults to now when marked done; never in the future)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  completedAt?: string | null;

  @ApiPropertyOptional({ type: [RcaCompletionAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RcaCompletionAttachmentDto)
  completionAttachments?: RcaCompletionAttachmentDto[];

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 2000,
    description:
      'CA4 objective evidence: work order, test report, drawing / procedure revision, calibration record',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  completionEvidenceRef?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  verificationWindowStart?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  verificationWindowEnd?: string | null;

  @ApiPropertyOptional({ type: RcaActionBaselineDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => RcaActionBaselineDto)
  baseline?: RcaActionBaselineDto | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "The owner's claimed avoided loss (decimal string); never added to approved loss",
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(DECIMAL)
  claimedAvoidedLoss?: string | null;

  @ApiPropertyOptional({ enum: CLAIM_CURRENCIES, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(CLAIM_CURRENCIES)
  claimedCurrency?: string | null;
}

export class RcaActionV2UpdateDto extends PartialType(RcaActionV2CreateDto) {}
