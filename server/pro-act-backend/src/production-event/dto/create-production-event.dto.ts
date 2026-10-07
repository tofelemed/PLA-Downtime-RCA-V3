import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateProductionEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  impactCodeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  oeeCodeId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsDateString()
  startTime: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiProperty({ enum: ['Manual', 'Simulated PI', 'CMMS'] })
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  cost?: number;

  @ApiProperty({ enum: ['Open', 'Coded', 'RCA Required', 'Closed', 'Investigating', 'In Progress', 'Completed', 'Cancelled'] })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  rcaId?: string;

  @ApiProperty({ enum: ['ProductionLoss', 'IOW', 'SOL', 'APM', 'FailureWO', 'ProductionOutput'] })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parameter?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiProperty({ required: false, enum: ['High', 'Low'] })
  @IsOptional()
  @IsString()
  limitType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  breachDuration?: number;

  @ApiProperty({ required: false, enum: ['Safety', 'Operational'] })
  @IsOptional()
  @IsString()
  solType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  apmType?: string;

  @ApiProperty({ required: false, enum: ['Low', 'Medium', 'High', 'Critical'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recommendedAction?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  workOrderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  failureMode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  defectiveQuantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shift?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  crew?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lossCategory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  operatorName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  reasonCodeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
} 