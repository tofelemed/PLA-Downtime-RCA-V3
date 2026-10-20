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
import {
  RCA_CAUSE_KINDS,
  RcaCauseKind,
} from '../../rca/entities/rca-cause.entity';
import { INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';

export const RCA_PORTFOLIO_CURRENCIES = ['USD', 'IRR'] as const;
export type RcaPortfolioCurrency = (typeof RCA_PORTFOLIO_CURRENCIES)[number];
export const RCA_PORTFOLIO_LIMIT_MAX = 50;

/** `GET /reports/rca-portfolio`: loss → cause → action → outcome per coded cause (item 2.1). */
export class RcaPortfolioQueryDto {
  @ApiProperty({
    description:
      'Cases opened at or after this instant (ISO 8601 with offset); the window counts a case by its opening',
  })
  @Matches(INSTANT, { message: `from ${INSTANT_MESSAGE}` })
  from: string = '';

  @ApiProperty({
    description:
      'Cases opened before this instant (exclusive); ≤ 400 days after from',
  })
  @Matches(INSTANT, { message: `to ${INSTANT_MESSAGE}` })
  to: string = '';

  @ApiPropertyOptional({
    type: [String],
    description:
      'Repeat for several units; units of the tenant and of the caller’s scope (422 INVALID_REFERENCE). ' +
      'Omitted: every unit the caller may read (tenant-wide cases for a tenant-wide caller only).',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({
    enum: RCA_CAUSE_KINDS,
    default: 'root',
    description:
      'The cause kind whose catalogue code groups the cases; cases without such a code form the Uncoded row',
  })
  @IsOptional()
  @IsIn(RCA_CAUSE_KINDS)
  causeKind?: RcaCauseKind;

  @ApiPropertyOptional({
    enum: RCA_PORTFOLIO_CURRENCIES,
    default: 'USD',
    description:
      'Approved loss and claims are reported in this currency only (nothing converted)',
  })
  @IsOptional()
  @IsIn(RCA_PORTFOLIO_CURRENCIES)
  currency?: RcaPortfolioCurrency;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: RCA_PORTFOLIO_LIMIT_MAX,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RCA_PORTFOLIO_LIMIT_MAX)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned as nextCursor by the previous page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}
