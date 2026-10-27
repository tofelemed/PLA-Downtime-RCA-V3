import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const FIGURE = { maxDecimalPlaces: 8 };

/** The plan the OT system declared against (provenance of the planned figure). */
export class DeclaredPlanDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  source?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 128 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(128)
  planId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  revision?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  approved?: boolean | null;
}

/** The PI tag and event frame the actual figure was read from. */
export class DeclaredPiSourceDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(255)
  actualTag?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(255)
  eventFrameId?: string | null;
}

/**
 * Declared mode: the figures the OT system declares for a `production_loss` event. The event's quantity is
 * the shortfall (send both only with equal values). Numbers in the event's unit of measure.
 */
export class DeclaredFiguresDto {
  @ApiPropertyOptional({ type: Number, example: 120, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber(FIGURE)
  planned?: number | null;

  @ApiPropertyOptional({ type: Number, example: 112.5, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber(FIGURE)
  actual?: number | null;

  @ApiProperty({
    example: 7.5,
    minimum: 0,
    description: 'planned - actual, 0 or more; becomes the event quantity',
  })
  @IsNumber(FIGURE)
  @Min(0)
  shortfall!: number;

  @ApiPropertyOptional({ example: 't', description: "Default 't'" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  uom?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  measurementQuality?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 64,
    example: 'CONFIRMED',
    description: 'OT status, e.g. DETECTED or CONFIRMED',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  sourceStatus?: string | null;

  @ApiPropertyOptional({ type: DeclaredPlanDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DeclaredPlanDto)
  plan?: DeclaredPlanDto | null;

  @ApiPropertyOptional({ type: DeclaredPiSourceDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DeclaredPiSourceDto)
  piSource?: DeclaredPiSourceDto | null;
}
