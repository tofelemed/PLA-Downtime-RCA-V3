import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import { ListQueryDto } from '../common/list-query.dto';
import type { ResidualState } from './period-summary.view';

export const GRID_WORKFLOW_STATES = [
  'none',
  'draft',
  'in_review',
  'stale',
  'approved',
] as const;
export const REVISION_SELECTORS = ['current', 'approved'] as const;
/** Plan-ledger residual states of a grid row (`PeriodPlanFiguresV2View.residualState`, ACC09/ACC10). */
export const RESIDUAL_STATES = [
  'not_computable',
  'balanced',
  'within_tolerance',
  'unaccounted',
  'over_accounted',
  'overproduction',
  'conflict',
] as const satisfies readonly ResidualState[];
const SUMMARY_SORTS = ['utcStart', '-utcStart'] as const;

/** `GET /period-summaries`: the Plan Dashboard period grid (plan 3.5). */
export class PeriodSummaryQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    enum: SUMMARY_SORTS,
    default: 'utcStart',
    description:
      'utcStart: oldest first; -utcStart: newest first (e.g. the period just before a date with to=<its start>&limit=1)',
  })
  @IsOptional()
  @IsIn(SUMMARY_SORTS)
  sort?: string = undefined;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
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
    type: [String],
    enum: GRID_WORKFLOW_STATES,
    description:
      'Workflow state of the shown revision (none = no revision yet; stale = in review with changed inputs)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @IsIn(GRID_WORKFLOW_STATES, { each: true })
  workflowState?: (typeof GRID_WORKFLOW_STATES)[number][];

  @ApiPropertyOptional({
    enum: REVISION_SELECTORS,
    default: 'current',
    description:
      'current: the open revision, else the published one; approved: the published revision only',
  })
  @IsOptional()
  @IsIn(REVISION_SELECTORS)
  view?: (typeof REVISION_SELECTORS)[number];

  @ApiPropertyOptional({
    type: [String],
    enum: RESIDUAL_STATES,
    description:
      'Plan-ledger residual state of the shown revision (repeat for several). The state is computed per period, ' +
      'so a filtered page examines at most 2,000 periods: it may hold fewer than `limit` rows while `nextCursor` ' +
      'is set — keep paging until `nextCursor` is null.',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(RESIDUAL_STATES.length)
  @IsIn(RESIDUAL_STATES, { each: true })
  residualStates?: ResidualState[];
}

/** `GET /reports/waterfall`: one ledger of 1–31 periods that close to actual (plan 3.5). */
export class WaterfallQueryDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'Periods of the tenant and the caller’s scope (repeat the parameter)',
  })
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @IsUUID('all', { each: true })
  periodIds: string[] = [];

  @ApiPropertyOptional({ enum: ['plan', 'capacity'], default: 'plan' })
  @IsOptional()
  @IsIn(['plan', 'capacity'])
  ledger?: 'plan' | 'capacity';

  @ApiPropertyOptional({
    enum: REVISION_SELECTORS,
    default: 'current',
    description:
      'current: the open revision (with its saved decisions), else the published one; approved: the published revision',
  })
  @IsOptional()
  @IsIn(REVISION_SELECTORS)
  view?: (typeof REVISION_SELECTORS)[number];
}
