import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { ListQueryDto } from '../common/list-query.dto';
import {
  EffectiveDto,
  INSTANT,
  INSTANT_MESSAGE,
} from '../profiles/profile-v2.dto';

const CURRENCY = /^[A-Z]{3}$/;
const CURRENCY_MESSAGE = 'must be an ISO 4217 code';
/** FX rates: up to 14 integer digits and 10 decimals (numeric(24,10)) */
const FX_RATE = /^\d{1,14}(\.\d{1,10})?$/;

/** Body of POST /fx-rates: a draft FX rate version, `1 fromCurrency = rate toCurrency`. */
export class FxRateCreateDto extends EffectiveDto {
  @ApiProperty({ example: 'USD' })
  @Matches(CURRENCY, { message: `fromCurrency ${CURRENCY_MESSAGE}` })
  fromCurrency: string;

  @ApiProperty({ example: 'IRR' })
  @Matches(CURRENCY, { message: `toCurrency ${CURRENCY_MESSAGE}` })
  toCurrency: string;

  @ApiProperty({
    example: '500000',
    description: 'Units of toCurrency per 1 fromCurrency; > 0, ≤ 10 decimals',
  })
  @Matches(FX_RATE, {
    message: 'rate must be a decimal string with at most 10 decimals',
  })
  rate: string;

  @ApiPropertyOptional({
    description: 'Where the rate comes from (free text)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string | null;
}

export class FxRateListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @Matches(CURRENCY, { message: `fromCurrency ${CURRENCY_MESSAGE}` })
  fromCurrency?: string;

  @ApiPropertyOptional({ example: 'IRR' })
  @IsOptional()
  @Matches(CURRENCY, { message: `toCurrency ${CURRENCY_MESSAGE}` })
  toCurrency?: string;

  @ApiPropertyOptional({ enum: VERSION_STATES })
  @IsOptional()
  @IsIn(VERSION_STATES)
  state?: VersionState;
}

/** Body of POST /valuation-policies: a new (unapproved) `valuation_basis` version of the tenant. */
export class ValuationPolicyCreateDto {
  @ApiProperty({ enum: ['contribution_margin', 'standard_cost'] })
  @IsIn(['contribution_margin', 'standard_cost'])
  defaultBasis: 'contribution_margin' | 'standard_cost';

  @ApiProperty({ enum: ['exclusive', 'independent_components'] })
  @IsIn(['exclusive', 'independent_components'])
  timeBasisRule: 'exclusive' | 'independent_components';

  @ApiProperty({ example: ['IRR', 'USD'], type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @Matches(CURRENCY, {
    each: true,
    message: `reportingCurrencies ${CURRENCY_MESSAGE}`,
  })
  reportingCurrencies: string[];

  @ApiProperty({ enum: ['none', 'snapshot'] })
  @IsIn(['none', 'snapshot'])
  fxPolicy: 'none' | 'snapshot';

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  independentImpactCodeIds?: string[];

  @ApiProperty({ example: '2027-01-01T00:00:00Z' })
  @Matches(INSTANT, { message: `effectiveFrom ${INSTANT_MESSAGE}` })
  effectiveFrom: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class ValuationPolicyListQueryDto extends ListQueryDto {}
