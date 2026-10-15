import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ANALOG_STOP_STATES } from '../../domain/reliability/analog-state';
import { PHYSICAL_STATES } from '../../domain/reliability/unit-state';
import { ListQueryDto } from '../common/list-query.dto';

export class StateRuleDto {
  @ApiProperty({
    maxLength: 100,
    example: 'RUN',
    description: 'Signal value: state name or code (no case)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  match: string;

  @ApiProperty({ enum: PHYSICAL_STATES })
  @IsIn(PHYSICAL_STATES)
  state: (typeof PHYSICAL_STATES)[number];
}

/** Plan 1.10 analog bands of a numeric signal value no rule matches (signal units). */
export class AnalogThresholdsDto {
  @ApiProperty({
    example: 2,
    description: 'Below this value the unit is stopped',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  stopBelow: number;

  @ApiPropertyOptional({
    type: Number,
    example: 16,
    nullable: true,
    description:
      'Below this value (and not stopped) the unit runs at a reduced rate; null = no reduced-rate band',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  reducedBelow?: number | null;

  @ApiPropertyOptional({
    example: 0.5,
    default: 0,
    minimum: 0,
    description:
      'A lower band is left only above its threshold + this hysteresis',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  hysteresis?: number;

  @ApiPropertyOptional({
    enum: ANALOG_STOP_STATES,
    default: 'internal_stop',
    description: 'State of an analog stop (the signal does not tell the cause)',
  })
  @IsOptional()
  @IsIn(ANALOG_STOP_STATES)
  stopState?: (typeof ANALOG_STOP_STATES)[number];

  @ApiPropertyOptional({
    type: Number,
    example: 20,
    nullable: true,
    description:
      'Signal value at the full rate: a slowdown loses 1 − mean / rated of the rate; null = not quantified',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ratedValue?: number | null;
}

export class UnitStateMappingCreateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'State signal of the unit (semantic type state)',
  })
  @IsUUID()
  signalId: string;

  @ApiProperty({
    type: [StateRuleDto],
    description:
      'Unmapped values are unknown time (data quality); may be empty with analog thresholds',
  })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => StateRuleDto)
  rules: StateRuleDto[];

  @ApiPropertyOptional({
    type: AnalogThresholdsDto,
    nullable: true,
    description:
      'Plan 1.10 analog mapping: numeric values no rule matches are banded stopped / reduced rate / running (hysteresis); reduced-rate spans become slowdown events',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => AnalogThresholdsDto)
  thresholds?: AnalogThresholdsDto | null;

  @ApiProperty({
    minimum: 1,
    maximum: 86400,
    description: 'Expected sample interval of the source (s)',
  })
  @IsInt()
  @Min(1)
  @Max(86400)
  expectedIntervalSeconds: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Known communication jitter (s)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  jitterSeconds?: number;

  @ApiPropertyOptional({
    minimum: 1,
    default: 3,
    description: 'Stale after this many intervals (SME D2 pilot: 3)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  staleAfterIntervals?: number;

  @ApiPropertyOptional({
    default: true,
    description:
      'false = exception-based source: a quiet signal is not lost communication (no staleness)',
  })
  @IsOptional()
  @IsBoolean()
  isHeartbeat?: boolean;

  @ApiPropertyOptional({ description: 'Start of this version (default now)' })
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UnitStateMappingListQueryDto extends ListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;
}

export class UnitStateCoverageQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    description: 'Window start, ISO 8601 (at most 31 days before `to`)',
  })
  @IsISO8601()
  from: string;

  @ApiProperty({ description: 'Window end (exclusive)' })
  @IsISO8601()
  to: string;
}
