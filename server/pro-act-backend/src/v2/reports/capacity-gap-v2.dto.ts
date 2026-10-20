import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import { INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';

export const CAPACITY_GAP_LIMIT_MAX = 200;

/** `GET /reports/capacity-gap`: approved rate kinds side by side per unit and product (plan 1.2). */
export class CapacityGapQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-19T08:00:00Z',
    description:
      'Instant the approved profile and rate versions must be in force at (ISO 8601 with an offset); default now',
  })
  @IsOptional()
  @Matches(INSTANT, { message: `at ${INSTANT_MESSAGE}` })
  at?: string;

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
    type: [String],
    description: 'Repeat for several products; omitted: every product',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    minimum: 1,
    maximum: CAPACITY_GAP_LIMIT_MAX,
    default: CAPACITY_GAP_LIMIT_MAX,
    description: 'Rows at most; `truncated` tells when more profiles match',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CAPACITY_GAP_LIMIT_MAX)
  limit?: number;
}
