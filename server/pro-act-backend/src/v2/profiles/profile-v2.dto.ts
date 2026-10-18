import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { RateTimebase } from '../../domain/actuals/actuals.types';
import {
  CAPACITY_MODELS,
  CapacityModel,
  RATE_TIMEBASES,
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { ListQueryDto } from '../common/list-query.dto';

/** ISO 8601 instant with an explicit offset (no server-local interpretation). */
export const INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
export const INSTANT_MESSAGE = 'must be an ISO 8601 instant with an offset';
/** numeric(24,8): up to 16 integer and 8 fraction digits, no sign (rates and values are ≥ 0). */
export const DECIMAL = /^\d{1,16}(\.\d{1,8})?$/;
const MODE = /^[A-Za-z0-9_.-]{1,64}$/;

/** Validity of a version: `[effectiveFrom, effectiveTo)`, open-ended when `effectiveTo` is absent. */
export class EffectiveDto {
  @ApiProperty({ example: '2026-10-01T02:30:00Z' })
  @Matches(INSTANT, { message: `effectiveFrom ${INSTANT_MESSAGE}` })
  effectiveFrom: string;

  @ApiPropertyOptional({
    example: '2027-01-01T02:30:00Z',
    nullable: true,
    description: 'Exclusive end; absent or null = open-ended',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(INSTANT, { message: `effectiveTo ${INSTANT_MESSAGE}` })
  effectiveTo?: string | null;
}

export class ProfileContentDto extends EffectiveDto {
  @ApiProperty({
    example: 't',
    description: 'Quantity unit of every rate of the profile',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  quantityUom: string;

  @ApiProperty({
    enum: RATE_TIMEBASES,
    description: 'Default timebase of the profile rates',
  })
  @IsIn(RATE_TIMEBASES)
  rateTimebase: RateTimebase;

  @ApiPropertyOptional({
    enum: CAPACITY_MODELS,
    default: 'single_stream',
    description:
      'shared_capacity / independent_streams are used by plans only behind CONCURRENT_PRODUCTS (D14)',
  })
  @IsOptional()
  @IsIn(CAPACITY_MODELS)
  capacityModel?: CapacityModel;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description:
      'Joint recipe of a shared_capacity profile (used by plan generation, 2.3)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  productMixConstraints?: Record<string, unknown> | null;
}

/** Body of POST /profiles: a draft for one unit, product and operating mode (next version). */
export class ProfileCreateDto extends ProfileContentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ default: 'normal', example: 'normal' })
  @IsOptional()
  @Matches(MODE, {
    message: 'operatingMode must be 1–64 letters, digits, _ . -',
  })
  operatingMode?: string;
}

/** Body of PATCH /profiles/{id} (drafts only): any subset of the content; the key is fixed. */
export class ProfilePatchDto extends PartialType(ProfileContentDto) {}

/** OpenAPI description shared by the approve commands of rates and valuation rates. */
export const APPROVE_DESCRIPTION =
  'Requires `Idempotency-Key`. SuperAdmin may approve its own draft; other authors cannot (403 SEPARATION_OF_DUTIES). ' +
  '409 VERSION_OVERLAP (details.conflicts) when it overlaps an approved version of ' +
  'the same key, unless `supersede` closes the predecessor exactly at its effectiveFrom (half-open).';

/** Body of POST …/approve. */
export class ApproveDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Close the one approved predecessor that starts before this version exactly at its effectiveFrom ' +
      '(any other overlap is still 409 VERSION_OVERLAP)',
  })
  @IsOptional()
  @IsBoolean()
  supersede?: boolean;
}

export class ProfileListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(MODE)
  operatingMode?: string;

  @ApiPropertyOptional({ enum: VERSION_STATES })
  @IsOptional()
  @IsIn(VERSION_STATES)
  state?: VersionState;
}

/** GET /profiles/resolve: the approved profile and rates in force at an instant. */
export class ProfileResolveQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ default: 'normal' })
  @IsOptional()
  @Matches(MODE)
  operatingMode?: string;

  @ApiProperty({ example: '2026-10-09T10:15:00Z' })
  @Matches(INSTANT, { message: `at ${INSTANT_MESSAGE}` })
  at: string;
}
