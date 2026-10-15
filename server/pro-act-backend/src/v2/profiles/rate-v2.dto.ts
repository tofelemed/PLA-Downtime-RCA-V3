import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RateTimebase } from '../../domain/actuals/actuals.types';
import {
  RATE_IMPORT_KINDS,
  RATE_KINDS,
  RATE_TIMEBASES,
  RateImportKind,
  RateKind,
  VALUATION_BASES,
  ValuationBasis,
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { MAX_IMPORT_ROWS } from '../../domain/profiles/rate-import-rows';
import { ListQueryDto } from '../common/list-query.dto';
import { DECIMAL, EffectiveDto } from './profile-v2.dto';

const DECIMAL_MESSAGE = 'must be a decimal string ≥ 0 with at most 8 decimals';
const MAX_CSV_LENGTH = 2_000_000;

/** Body of POST /profiles/{id}/rates: a draft rate version (next version of the profile and kind). */
export class RateCreateDto extends EffectiveDto {
  @ApiProperty({ enum: RATE_KINDS })
  @IsIn(RATE_KINDS)
  rateKind: RateKind;

  @ApiProperty({
    example: '120',
    description:
      'Quantity (profile quantityUom) per timebase; > 0 except budget/forecast',
  })
  @Matches(DECIMAL, { message: `rate ${DECIMAL_MESSAGE}` })
  rate: string;

  @ApiProperty({ enum: RATE_TIMEBASES })
  @IsIn(RATE_TIMEBASES)
  timebase: RateTimebase;
}

export class RateListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: RATE_KINDS })
  @IsOptional()
  @IsIn(RATE_KINDS)
  rateKind?: RateKind;

  @ApiPropertyOptional({ enum: VERSION_STATES })
  @IsOptional()
  @IsIn(VERSION_STATES)
  state?: VersionState;
}

/** Body of POST /valuation-rates: owned by a profile xor an impact code. */
export class ValuationRateCreateDto extends EffectiveDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'contribution_margin / standard_cost per quantity',
  })
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'cost_per_hour (or standard_cost per unit)',
  })
  @IsOptional()
  @IsUUID()
  impactCodeId?: string;

  @ApiProperty({ enum: VALUATION_BASES })
  @IsIn(VALUATION_BASES)
  basis: ValuationBasis;

  @ApiProperty({ example: '42.5' })
  @Matches(DECIMAL, { message: `value ${DECIMAL_MESSAGE}` })
  value: string;

  @ApiPropertyOptional({
    example: 'IRR',
    description:
      'ISO 4217; required for money bases, omitted for rework_yield (a ratio: recovered per reworked quantity, 0 < value ≤ 1)',
  })
  @ValidateIf((dto: ValuationRateCreateDto) => dto.basis !== 'rework_yield')
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be an ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({
    description:
      'Defaults to the profile quantityUom (must match it) or "h" for cost_per_hour',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  perUom?: string;
}

export class ValuationRateListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  impactCodeId?: string;

  @ApiPropertyOptional({ enum: VALUATION_BASES })
  @IsOptional()
  @IsIn(VALUATION_BASES)
  basis?: ValuationBasis;

  @ApiPropertyOptional({ enum: VERSION_STATES })
  @IsOptional()
  @IsIn(VERSION_STATES)
  state?: VersionState;
}

/**
 * One import row. Only the shape is checked here; content errors (codes, rates, intervals, overlaps)
 * are reported per line in the import report, so one bad row never hides the others.
 */
export class RateImportRowDto {
  @ApiProperty({ example: 'unit100' })
  @IsString()
  @MaxLength(255)
  unitCode: string;

  @ApiProperty({ example: 'HDPE-A' })
  @IsString()
  @MaxLength(255)
  productCode: string;

  @ApiPropertyOptional({ default: 'normal' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  operatingMode?: string;

  @ApiProperty({ example: '115.5' })
  @IsString()
  @MaxLength(40)
  rate: string;

  @ApiProperty({ enum: RATE_TIMEBASES })
  @IsString()
  @MaxLength(8)
  timebase: string;

  @ApiProperty({ example: '2026-11-01T02:30:00Z' })
  @IsString()
  @MaxLength(40)
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-01T02:30:00Z' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  effectiveTo?: string;
}

/** Body of POST /rate-imports: one revision of a budget / forecast / MPC document (rows xor csv). */
export class RateImportCreateDto {
  @ApiProperty({
    enum: RATE_IMPORT_KINDS,
    description: 'mpc rows become sustained rates',
  })
  @IsIn(RATE_IMPORT_KINDS)
  kind: RateImportKind;

  @ApiProperty({
    example: 'FC-2026-11',
    description:
      'Document id; a later delivery of the same id is a correction (next revision)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  externalId: string;

  @ApiPropertyOptional({ example: 'forecast-nov.csv' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileRef?: string;

  @ApiPropertyOptional({ type: [RateImportRowDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => RateImportRowDto)
  rows?: RateImportRowDto[];

  @ApiPropertyOptional({
    description:
      'CSV with header unitCode,productCode,operatingMode,rate,timebase,effectiveFrom,effectiveTo',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CSV_LENGTH)
  csv?: string;
}
