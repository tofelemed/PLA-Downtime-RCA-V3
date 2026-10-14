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
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
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
    description: 'Unmapped values are unknown time (data quality)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => StateRuleDto)
  rules: StateRuleDto[];

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
