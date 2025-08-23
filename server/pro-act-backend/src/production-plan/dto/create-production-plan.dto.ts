import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductionPlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsNumber()
  plannedQuantity: number;

  @ApiProperty()
  @IsNumber()
  toleranceLimit: number;

  @ApiProperty()
  @IsDateString()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty()
  @IsDateString()
  @Type(() => Date)
  endDate: Date;

  @ApiProperty()
  @IsUUID()
  tenantId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  planBasis?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  usefulProductionTime?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recurrence?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dataEntryFrequency?: string;

  @ApiProperty({ enum: ['Planned', 'Active', 'Completed', 'Cancelled'] })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  actualQuantity?: number;

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
  plannerNotes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiProperty({ enum: ['Draft', 'Pending Review', 'Pending Approval', 'Approved', 'Rejected'] })
  @IsString()
  @IsNotEmpty()
  approvalStatus: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  submittedBy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  submittedAt?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reviewedBy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  reviewedAt?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  approvedBy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  approvedAt?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customAttributes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  auditTrail?: string;
} 