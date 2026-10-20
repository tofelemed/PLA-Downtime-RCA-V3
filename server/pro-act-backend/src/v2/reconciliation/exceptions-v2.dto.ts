import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';

/**
 * Plan 2.4: the open accounting problems the queue lists, each read from stored state only (no recalculation
 * on read): the latest run's slice flags, the revision's stale mark, the actuals' substitution flag, the
 * stops and the duplicate-stop suggestions.
 */
export const EXCEPTION_TYPES = [
  'residual_beyond_tolerance',
  'claim_exceeds_component',
  'bridge_required',
  'plan_allocation_required',
  'stale_submission',
  'substitute_source',
  'uncoded_stop_time',
  'duplicate_merge_pending',
] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

/** Workflow states of a period that is not approved (`none` = never reconciled; `stale` = in review, stale). */
export const EXCEPTION_WORKFLOWS = [
  'none',
  'draft',
  'in_review',
  'stale',
] as const;
export type ExceptionWorkflow = (typeof EXCEPTION_WORKFLOWS)[number];

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ReconciliationExceptionsQueryDto {
  @ApiProperty({
    description:
      'Periods of operational dates on or after this date (YYYY-MM-DD, plant production day)',
  })
  @Matches(LOCAL_DATE, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate: string = '';

  @ApiProperty({
    description:
      'Periods of operational dates before this date (exclusive, YYYY-MM-DD); ≤ 400 days after fromDate',
  })
  @Matches(LOCAL_DATE, { message: 'toDate must be YYYY-MM-DD' })
  toDate: string = '';

  @ApiPropertyOptional({
    enum: EXCEPTION_TYPES,
    isArray: true,
    description: 'Repeat for several types; omitted = every type',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(EXCEPTION_TYPES.length)
  @IsIn(EXCEPTION_TYPES, { each: true })
  types?: ExceptionType[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Repeat for several units; units of the tenant and of the caller’s scope (422 INVALID_REFERENCE). ' +
      'Omitted: every unit the caller may read.',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({
    enum: EXCEPTION_WORKFLOWS,
    isArray: true,
    description:
      'Workflow state of the period; omitted = every state that is not approved',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(EXCEPTION_WORKFLOWS.length)
  @IsIn(EXCEPTION_WORKFLOWS, { each: true })
  workflowStates?: ExceptionWorkflow[];

  @ApiPropertyOptional({ description: 'nextCursor of the previous page' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}
