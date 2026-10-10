import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  BASELINE_METRICS,
  BaselineMetric,
} from '../../domain/rca/rca-verification';
import {
  RCA_ACTION_STATUSES,
  RcaActionStatus,
} from '../../rca/entities/rca-action.entity';

const DECIMAL = /^\d{1,16}(\.\d{1,8})?$/;
export const CLAIM_CURRENCIES = ['IRR', 'USD'] as const;

export class RcaActionBaselineDto {
  @ApiProperty({ enum: BASELINE_METRICS })
  @IsIn(BASELINE_METRICS)
  metric: BaselineMetric;

  @ApiProperty({
    minimum: 1,
    maximum: 365,
    description: 'Baseline window length in days',
  })
  @IsInt()
  @Min(1)
  @Max(365)
  windowDays: number;

  @ApiPropertyOptional({
    description:
      'Declared value (decimal string). Omitted: the server counts it over the windowDays before the verification window',
  })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL)
  value?: string;
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
    nullable: true,
    maxLength: 2000,
    description:
      'Where the completion evidence is (document, work order, photo reference)',
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
