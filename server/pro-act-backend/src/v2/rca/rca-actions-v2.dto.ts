import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
  toArrayParam,
  toBooleanParam,
} from '../../common/dto/query-param.transformers';
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
import { ListQueryDto } from '../common/list-query.dto';

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

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 2000,
    description:
      'CA4: how the completion will be verified (inspection, test, record review)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  verificationMethod?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'CA4: the plant member named to check the completion evidence and mark the action done; never the owner ' +
      '(422 VERIFIER_IS_OWNER). When named, only this person marks the action done (403 NOT_THE_VERIFIER).',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  verifierId?: string | null;

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

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 64,
    description:
      'Item 5: id of the case recommendation this action implements (422 INVALID_REFERENCE when the case has no such recommendation); null unlinks',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  recommendationId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 2000,
    description:
      'F-9: why the action is cancelled; accepted only with status cancelled (or on a cancelled action, 422 ' +
      'CANCEL_REASON_WITHOUT_CANCEL otherwise). Optional; who and when are recorded by the server.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  cancelReason?: string | null;
}

export class RcaActionV2UpdateDto extends PartialType(RcaActionV2CreateDto) {}

export const RCA_ACTION_LIST_SORTS = ['dueDate'] as const;

/**
 * `GET /v2/rca-actions` (F-7): actions across the cases of your scope, due date first (no due date
 * last). Repeat `status` for several statuses.
 */
export class RcaActionV2ListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    description: 'true = only actions you own (the signed-in user)',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ description: 'Actions of this owner' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({
    enum: RCA_ACTION_STATUSES,
    isArray: true,
    description: 'Statuses (repeat the parameter)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(RCA_ACTION_STATUSES.length)
  @IsIn(RCA_ACTION_STATUSES, { each: true })
  status?: RcaActionStatus[];

  @ApiPropertyOptional({
    description:
      'true = open or in progress with the due date passed (the overdue count of GET /v2/rcas/summary); false = the others',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Actions of this case' })
  @IsOptional()
  @IsUUID()
  rcaId?: string;

  @ApiPropertyOptional({ description: 'Actions of cases of this unit' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: RCA_ACTION_LIST_SORTS })
  @IsOptional()
  @IsIn(RCA_ACTION_LIST_SORTS)
  sort?: string = undefined;
}
