import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import {
  BAD_ACTOR_GROUPS,
  BAD_ACTOR_RANKS,
  BadActorGroup,
  BadActorRank,
} from '../../domain/rca/bad-actor';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const BAD_ACTOR_CURRENCIES = ['USD', 'IRR'] as const;

/** `GET /reports/bad-actors`: CA8 monthly bad-actor review (top assets / failure modes). */
export class BadActorReportQueryDto {
  @ApiProperty({
    example: '2027-03',
    description:
      'Review month (YYYY-MM in the plant calendar — a Persian plant names a Jalali month, e.g. 1405-07 = ' +
      'Mehr 1405 — at local midnight in the plant time zone): the rolling window of the tenant RCA policy (CA8 pilot 90 days) ' +
      'ending at the end of this month',
  })
  @Matches(MONTH, { message: 'month must be YYYY-MM' })
  month: string = '';

  @ApiPropertyOptional({ enum: BAD_ACTOR_GROUPS, default: 'asset' })
  @IsOptional()
  @IsIn(BAD_ACTOR_GROUPS)
  groupBy?: BadActorGroup;

  @ApiPropertyOptional({
    enum: BAD_ACTOR_RANKS,
    default: 'quantity',
    description:
      'quantity = approved lost quantity (D14, the unit of measure with the most approved loss); value = ' +
      'approved value of the policy default view in `currency` (unvalued groups last, never zero); stops = ' +
      'unplanned stops and failure work orders',
  })
  @IsOptional()
  @IsIn(BAD_ACTOR_RANKS)
  rankBy?: BadActorRank;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    enum: BAD_ACTOR_CURRENCIES,
    default: 'USD',
    description: 'Currency of the value column and the value ranking',
  })
  @IsOptional()
  @IsIn(BAD_ACTOR_CURRENCIES)
  currency?: (typeof BAD_ACTOR_CURRENCIES)[number];

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
}
