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
import { INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';

export const STATEMENT_REVISIONS = ['approved', 'provisional'] as const;
export type StatementRevision = (typeof STATEMENT_REVISIONS)[number];

export const STATEMENT_LIMIT_DEFAULT = 50;
export const STATEMENT_LIMIT_MAX = 200;

/** `GET /v2/reports/loss-statement` (Task 13): window, units, revision and the keyset page of the rows. */
export class LossStatementQueryDto {
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
      'Omitted: every unit the caller may read.',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({
    enum: STATEMENT_REVISIONS,
    default: 'provisional',
    description:
      '`approved`: approved revisions only (periods without one are left out and counted in `incomplete`); ' +
      '`provisional`: the approved revision, else the open draft (marked provisional)',
  })
  @IsOptional()
  @IsIn(STATEMENT_REVISIONS)
  revision?: StatementRevision;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned as nextCursor by the previous page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: STATEMENT_LIMIT_MAX,
    default: STATEMENT_LIMIT_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(STATEMENT_LIMIT_MAX)
  limit: number = STATEMENT_LIMIT_DEFAULT;
}
