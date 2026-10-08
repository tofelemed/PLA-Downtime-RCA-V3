import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const LIST_LIMIT_DEFAULT = 100;
export const LIST_LIMIT_MAX = 500;

/**
 * Base query for every v2 list endpoint (API01): opaque cursor, bounded limit, allowlisted sort and a
 * half-open time window. Resources extend it, redeclare `sort` with `@IsIn(<their fields>)` and add
 * their own array filters (repeated params → OR within a dimension, different params → AND).
 */
export class ListQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor returned as nextCursor by the previous page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: LIST_LIMIT_MAX,
    default: LIST_LIMIT_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIST_LIMIT_MAX)
  limit: number = LIST_LIMIT_DEFAULT;

  @ApiPropertyOptional({
    description:
      'Sort field; prefix "-" for descending. Each resource allowlists its fields; id is always the tiebreak',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?[A-Za-z][A-Za-z0-9_]*$/)
  sort?: string;

  @ApiPropertyOptional({
    description:
      'Window start, ISO 8601 (inclusive); intervals use overlap semantics',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Window end, ISO 8601 (exclusive)' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
