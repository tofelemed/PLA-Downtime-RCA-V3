import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Trims a string body field; other values pass through to the validators. */
export const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const CAPACITY_PATTERN = /^\d{1,11}(\.\d{1,4})?$/;
const CYCLE_TIME_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

export class UnitV2CreateDto {
  @ApiProperty({ maxLength: 50, example: 'EXT-LINE-3' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Site of the plant (GET /v2/sites); null or absent = the plant default site (422 SITE_NOT_IN_PLANT)',
  })
  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @IsUUID()
  siteId?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true, example: 't' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitOfMeasure?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Legacy v1 capacity (decimal string, up to 4 decimals); not used by v2 calculations',
  })
  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(CAPACITY_PATTERN, {
    message: 'capacity must be a non-negative decimal',
  })
  capacity?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Legacy v1 ideal cycle time, seconds per unit (decimal string); not used by v2 calculations',
  })
  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(CYCLE_TIME_PATTERN, {
    message:
      'idealCycleTimeSeconds must be a non-negative decimal with up to 2 decimals',
  })
  idealCycleTimeSeconds?: string | null;
}

/** PATCH body: every field optional; `null` clears an optional field. */
export class UnitV2ChangeDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Site of the plant (GET /v2/sites); null or absent = the plant default site (422 SITE_NOT_IN_PLANT)',
  })
  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @IsUUID()
  siteId?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitOfMeasure?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(CAPACITY_PATTERN, {
    message: 'capacity must be a non-negative decimal',
  })
  capacity?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(CYCLE_TIME_PATTERN, {
    message:
      'idealCycleTimeSeconds must be a non-negative decimal with up to 2 decimals',
  })
  idealCycleTimeSeconds?: string | null;
}
