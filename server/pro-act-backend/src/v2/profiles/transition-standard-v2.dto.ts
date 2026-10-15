import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { ListQueryDto } from '../common/list-query.dto';
import { DECIMAL, EffectiveDto } from './profile-v2.dto';

const DECIMAL_MESSAGE = 'must be a decimal string ≥ 0 with at most 8 decimals';
/** Same code shape as a profile's operating mode. */
const CONTEXT_CODE = /^[A-Za-z0-9_.-]{1,64}$/;
const CONTEXT_MESSAGE = 'must be 1–64 letters, digits, _ . -';

/** Body of POST /transition-standards: a draft entry of the unit's grade-transition matrix (LA-08). */
export class TransitionStandardCreateDto extends EffectiveDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Product (grade) before the change',
  })
  @IsUUID()
  fromProductId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Product (grade) after the change; B→A is its own entry',
  })
  @IsUUID()
  toProductId: string;

  @ApiPropertyOptional({
    example: 'ziegler_natta',
    nullable: true,
    description:
      'SME E1: catalyst family the entry applies to; absent / null = any (the most specific approved entry wins)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(CONTEXT_CODE, { message: `catalystFamily ${CONTEXT_MESSAGE}` })
  catalystFamily?: string | null;

  @ApiPropertyOptional({
    example: 'normal',
    nullable: true,
    description:
      'SME E1: operating mode the entry applies to (as on production profiles); absent / null = any',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(CONTEXT_CODE, { message: `operatingMode ${CONTEXT_MESSAGE}` })
  operatingMode?: string | null;

  @ApiProperty({
    example: '7560',
    description: 'Reference duration of the transition in seconds (> 0)',
  })
  @Matches(DECIMAL, { message: `referenceSeconds ${DECIMAL_MESSAGE}` })
  referenceSeconds: string;

  @ApiPropertyOptional({
    example: '18',
    nullable: true,
    description:
      'Reference off-grade quantity per transition; absent = the time share bounds the off-grade allowance',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DECIMAL, { message: `referenceOffgradeQty ${DECIMAL_MESSAGE}` })
  referenceOffgradeQty?: string | null;

  @ApiPropertyOptional({ example: 't', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(50)
  offgradeUom?: string | null;

  @ApiPropertyOptional({
    example: 5,
    nullable: true,
    description: 'Comparable transitions the reference was derived from',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  sampleCount?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Derivation: observations, licensor / engineering guidance, boundary',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  evidence?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class TransitionStandardListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fromProductId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  toProductId?: string;

  @ApiPropertyOptional({ enum: VERSION_STATES })
  @IsOptional()
  @IsIn(VERSION_STATES)
  state?: VersionState;
}
