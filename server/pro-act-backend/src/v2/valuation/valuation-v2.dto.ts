import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
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
import {
  DEMAND_RULES,
  DemandRule,
  FX_DATE_RULES,
  FX_RATE_TYPES,
  FxDateRule,
  FxRateType,
  QUALITY_DISPOSITIONS,
  QualityDisposition,
} from '../../domain/valuation/valuation.types';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
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
  @ApiPropertyOptional({
    enum: FX_RATE_TYPES,
    default: 'economic',
    description:
      'SME V5: the rate table by purpose — economic (treasury evidenced conversion basis), group_reporting ' +
      '(group translation policy) or budget. Name the market or fixing in `source`, not here.',
  })
  @IsOptional()
  @IsIn(FX_RATE_TYPES)
  rateType?: FxRateType;

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

  @ApiPropertyOptional({
    default: false,
    description:
      'SME V7: an authorised provisional rate for dates whose final rate is not approved yet (effectiveTo ' +
      'required, 422 PROVISIONAL_RATE_UNBOUNDED). Converts only where no final rate covers the date; every ' +
      'value it produces is marked provisional and revalued when the final rate is approved.',
  })
  @IsOptional()
  @IsBoolean()
  provisional?: boolean;
}

export class FxRateListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: FX_RATE_TYPES })
  @IsOptional()
  @IsIn(FX_RATE_TYPES)
  rateType?: FxRateType;

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

  @ApiPropertyOptional({
    description: 'SME V7: only provisional (true) or only final (false) rates',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  provisional?: boolean;
}

/** Body of POST /valuation-policies: a new (unapproved) `valuation_basis` version of the tenant. */
export class ValuationPolicyCreateDto {
  @ApiProperty({
    enum: ['contribution_margin', 'standard_cost', 'economic_impact'],
    description:
      'SME V8: economic_impact (lost contribution on unrecovered sales + incremental costs) needs demandRule',
  })
  @IsIn(['contribution_margin', 'standard_cost', 'economic_impact'])
  defaultBasis: 'contribution_margin' | 'standard_cost' | 'economic_impact';

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

  @ApiPropertyOptional({
    enum: FX_RATE_TYPES,
    description:
      'SME V5 (version 3): the FX rate table that converts (default economic)',
  })
  @IsOptional()
  @IsIn(FX_RATE_TYPES)
  fxRateType?: FxRateType;

  @ApiPropertyOptional({
    enum: FX_DATE_RULES,
    description:
      'SME V6: event_date (rate at each loss, summed into the month) or period_average (local-month average)',
  })
  @IsOptional()
  @IsIn(FX_DATE_RULES)
  fxDateRule?: FxDateRule;

  @ApiPropertyOptional({
    nullable: true,
    example: '0.05',
    description:
      'period_average only: refuse the average when a rate of the month deviates more than this ratio',
  })
  @IsOptional()
  @Matches(/^(0(\.\d{1,6})?|1(\.0{1,6})?)$/, {
    message: 'fxAverageMaxDeviation must be a ratio between 0 and 1',
  })
  fxAverageMaxDeviation?: string | null;

  @ApiPropertyOptional({
    enum: DEMAND_RULES,
    description:
      'SME V3: presence enables the economic view; demand_constrained_only charges lost contribution only ' +
      'where an approved demand status says the product was sold out',
  })
  @IsOptional()
  @IsIn(DEMAND_RULES)
  demandRule?: DemandRule;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string', enum: [...QUALITY_DISPOSITIONS] },
    description:
      'SME V2: impact code id → scrap | downgrade | rework (impact codes of the tenant, 422 INVALID_REFERENCE)',
  })
  @IsOptional()
  @IsObject()
  qualityDispositions?: Record<string, QualityDisposition>;

  @ApiPropertyOptional({ enum: QUALITY_DISPOSITIONS, nullable: true })
  @IsOptional()
  @IsIn(QUALITY_DISPOSITIONS)
  defaultQualityDisposition?: QualityDisposition | null;

  @ApiPropertyOptional({
    description:
      'SME V4: manual downtime lines get a cost-per-hour value from the hours of their evidenced events',
  })
  @IsOptional()
  @IsBoolean()
  manualLineHours?: boolean;

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
