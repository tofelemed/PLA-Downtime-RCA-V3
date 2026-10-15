import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { ListQueryDto } from '../common/list-query.dto';
import {
  DECIMAL,
  EffectiveDto,
  INSTANT,
  INSTANT_MESSAGE,
} from '../profiles/profile-v2.dto';

/** Stream code: the shape of a profile's operating mode. */
export const STREAM_CODE = /^[A-Za-z0-9_.-]{1,64}$/;
export const STREAM_CODE_MESSAGE = 'must be 1–64 letters, digits, _ . -';

/** Body of POST /unit-streams: a draft stream version (SME E6). */
export class UnitStreamCreateDto extends EffectiveDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    example: 'T1',
    description: 'Stream code, stable within the unit',
  })
  @Matches(STREAM_CODE, { message: `code ${STREAM_CODE_MESSAGE}` })
  code: string;

  @ApiProperty({ example: 'Train 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: '0.6',
    description:
      "Share of the unit's rate the stream provides, (0, 1]; Σ over the unit's approved streams ≤ 1 (409 STREAM_SHARE_EXCEEDED)",
  })
  @Matches(DECIMAL, { message: 'capacityShare must be a decimal string' })
  capacityShare: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class UnitStreamListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: VERSION_STATES })
  @IsOptional()
  @IsIn(VERSION_STATES)
  state?: VersionState;
}

/** Body of POST /stream-runs: which product a stream runs from `startTime` (SME E6). */
export class StreamRunCreateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    example: 'T1',
    description: 'An approved stream of the unit in force at startTime',
  })
  @Matches(STREAM_CODE, { message: `streamCode ${STREAM_CODE_MESSAGE}` })
  streamCode: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    example: 'L-2027-0412',
    nullable: true,
    description:
      'Production lot made on this run (unique per tenant, 409 LOT_CODE_TAKEN)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  lotCode?: string | null;

  @ApiProperty({ example: '2027-03-01T06:00:00Z' })
  @Matches(INSTANT, { message: `startTime ${INSTANT_MESSAGE}` })
  startTime: string;

  @ApiPropertyOptional({
    example: '2027-03-01T14:00:00Z',
    nullable: true,
    description: 'Exclusive end; absent or null = still running',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(INSTANT, { message: `endTime ${INSTANT_MESSAGE}` })
  endTime?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

/** Body of PATCH /stream-runs/{id}: end the run or correct its lot / notes. */
export class StreamRunPatchDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(INSTANT, { message: `endTime ${INSTANT_MESSAGE}` })
  endTime?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  lotCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class StreamRunListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ example: 'T1' })
  @IsOptional()
  @Matches(STREAM_CODE, { message: `streamCode ${STREAM_CODE_MESSAGE}` })
  streamCode?: string;
}
