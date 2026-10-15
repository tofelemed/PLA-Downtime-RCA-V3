import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import { OPERATION_KINDS } from '../../reliability/entities/work-order-operation.entity';
import { ListQueryDto } from '../common/list-query.dto';

export const MAX_OPERATION_ROWS = 5000;

export class WorkOrderOperationListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Operations linked to these stops (repeat)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  eventIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Operations on these assets (repeat)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  assetIds?: string[];
}

/** One CMMS operation, mapped from the export (SAP PM order operation, Maximo task, …). */
export class WorkOrderOperationRowDto {
  @ApiProperty({ maxLength: 100, example: '4000123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  workOrderId: string;

  @ApiProperty({ maxLength: 50, example: '0020' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  operationId: string;

  @ApiProperty({
    enum: OPERATION_KINDS,
    description: 'diagnosis, repair and test count as active repair',
  })
  @IsIn(OPERATION_KINDS)
  kind: (typeof OPERATION_KINDS)[number];

  @ApiProperty({
    description: 'Actual start of the operation (not the work-order creation)',
  })
  @IsISO8601()
  startedAt: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Actual end; absent = still running',
  })
  @IsOptional()
  @IsISO8601()
  endedAt?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Waiting for parts, permit or crew inside the operation (s)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  waitingSeconds?: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  waitingReason?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({
    maxLength: 50,
    description: 'Asset code (functional location) when no assetId',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  assetCode?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The stop it repaired; absent = the stop of the asset running at the operation start, if one',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 50, example: 'SAP PM' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}

export class WorkOrderOperationsImportDto {
  @ApiProperty({
    type: [WorkOrderOperationRowDto],
    maxItems: MAX_OPERATION_ROWS,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_OPERATION_ROWS)
  @ValidateNested({ each: true })
  @Type(() => WorkOrderOperationRowDto)
  operations: WorkOrderOperationRowDto[];
}

export class RepairEvidenceQueryDto {
  @ApiProperty({ format: 'uuid', description: 'The stop (production event)' })
  @IsUUID()
  eventId: string;
}
