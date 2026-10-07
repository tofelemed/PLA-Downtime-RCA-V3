import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateProductionPlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiProperty({ required: false, description: 'Target quantity' })
  @IsOptional()
  @IsNumber()
  plannedQuantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  actualQuantity?: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ required: false, enum: ['Planned', 'Active', 'Completed', 'Cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  toleranceLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  planBasis?: string;

  @ApiProperty({ required: false, description: 'JSON string of useful production time' })
  @IsOptional()
  @IsString()
  usefulProductionTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recurrence?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dataEntryFrequency?: string;

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

  @ApiProperty({ required: false, description: 'JSON string of comments array' })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiProperty({ required: false, enum: ['Draft', 'Pending Review', 'Pending Approval', 'Approved', 'Rejected'] })
  @IsOptional()
  @IsString()
  approvalStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  submittedBy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  submittedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reviewedBy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  reviewedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  approvedBy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  approvedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiProperty({ required: false, description: 'JSON string of custom attributes' })
  @IsOptional()
  @IsString()
  customAttributes?: string;

  @ApiProperty({ required: false, description: 'JSON string of audit trail array' })
  @IsOptional()
  @IsString()
  auditTrail?: string;
}
