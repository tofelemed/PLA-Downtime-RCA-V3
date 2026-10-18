import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  RCA_CAUSE_KINDS,
  RcaCauseKind,
} from '../../rca/entities/rca-cause.entity';
import { OptionalStrings, OptionalUuid } from './rca-dto-helpers';

/** A typed cause of a case (item 7): kind, catalogue code, statement and what supports it. */
export class RcaCaseCauseV2CreateDto {
  @ApiProperty({ enum: RCA_CAUSE_KINDS })
  @IsIn(RCA_CAUSE_KINDS)
  kind: RcaCauseKind;

  /** an active cause of the plant's cause catalogue (422 CAUSE_CODE_RETIRED for a retired one) */
  @OptionalUuid() causeCodeId?: string | null;

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  statement: string;

  /** ids of evidence items of the case that support the cause */
  @OptionalStrings(50, 64) evidenceIds?: string[];

  /** ids of logic-tree nodes of the case the cause stands for */
  @OptionalStrings(50, 64) nodeIds?: string[];
}

export class RcaCaseCauseV2UpdateDto extends PartialType(
  RcaCaseCauseV2CreateDto,
) {}

export const RCA_CAUSE_REPORT_SORTS = ['cases', 'approvedLoss'] as const;

/** `GET /v2/reports/rca-causes`: recurring causes of the plant. */
export class RcaCauseReportQueryDto {
  @ApiPropertyOptional({
    enum: RCA_CAUSE_KINDS,
    description: 'Only causes of this kind (all kinds when omitted)',
  })
  @IsOptional()
  @IsIn(RCA_CAUSE_KINDS)
  kind?: RcaCauseKind;

  @ApiPropertyOptional({ description: 'Cases of this unit only' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({
    enum: RCA_CAUSE_REPORT_SORTS,
    default: 'cases',
    description:
      'cases: by number of cases (server ranking); approvedLoss: the top `limit` codes by cases, ordered by ' +
      'their approved loss in `currency` (unvalued last)',
  })
  @IsOptional()
  @IsIn(RCA_CAUSE_REPORT_SORTS)
  sort?: (typeof RCA_CAUSE_REPORT_SORTS)[number];

  @ApiPropertyOptional({ default: 'USD', maxLength: 3 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
