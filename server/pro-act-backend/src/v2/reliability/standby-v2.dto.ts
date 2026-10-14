import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import { STANDBY_EVALUATIONS } from '../../reliability/entities/standby-equipment.entity';
import {
  STANDBY_OUTCOMES,
  STANDBY_RECORD_KINDS,
} from '../../reliability/entities/standby-record.entity';
import { ListQueryDto } from '../common/list-query.dto';

export const MAX_STANDBY_ROWS = 5000;

export class StandbyEquipmentCreateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assetId: string;

  @ApiProperty({
    enum: STANDBY_EVALUATIONS,
    description: 'How maintenance evaluates the asset (SME D9)',
  })
  @IsIn(STANDBY_EVALUATIONS)
  evaluation: (typeof STANDBY_EVALUATIONS)[number];

  @ApiPropertyOptional({
    description: 'Start of the standby duty (default now)',
  })
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class StandbyEquipmentRetireDto {
  @ApiPropertyOptional({ description: 'End of the standby duty (default now)' })
  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;
}

export class StandbyListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'These assets only (repeat)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  assetIds?: string[];
}

export class StandbyMetricsQueryDto {
  @ApiProperty({ description: 'Window start (inclusive), ISO 8601' })
  @IsISO8601()
  from: string;

  @ApiProperty({ description: 'Window end (exclusive), ISO 8601' })
  @IsISO8601()
  to: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'These assets only (repeat)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  assetIds?: string[];
}

/** One log entry; the asset by id or by code. */
export class StandbyRecordRowDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({
    maxLength: 50,
    description: 'Asset code (when no assetId)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  assetCode?: string;

  @ApiProperty({ enum: STANDBY_RECORD_KINDS })
  @IsIn(STANDBY_RECORD_KINDS)
  kind: (typeof STANDBY_RECORD_KINDS)[number];

  @ApiProperty()
  @IsISO8601()
  startedAt: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  endedAt?: string | null;

  @ApiProperty({ enum: STANDBY_OUTCOMES })
  @IsIn(STANDBY_OUTCOMES)
  outcome: (typeof STANDBY_OUTCOMES)[number];

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Stop of the duty equipment that caused the demand',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'The log’s own id: a re-import replaces the entry',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalRef?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class StandbyRecordsImportDto {
  @ApiProperty({ type: [StandbyRecordRowDto], maxItems: MAX_STANDBY_ROWS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STANDBY_ROWS)
  @ValidateNested({ each: true })
  @Type(() => StandbyRecordRowDto)
  records: StandbyRecordRowDto[];
}
