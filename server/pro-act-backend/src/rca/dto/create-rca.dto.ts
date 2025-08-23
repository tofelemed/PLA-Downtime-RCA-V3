import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsArray, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRcaDto {
  @ApiProperty()
  @IsUUID()
  eventId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: ['Draft', 'In Progress', 'Analysis', 'Published', 'Closed'] })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty()
  @IsUUID()
  teamLeadId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  teamMemberIds: string[];

  @ApiProperty({ enum: ['Low', 'Medium', 'High', 'Critical'] })
  @IsString()
  @IsNotEmpty()
  priority: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  targetCloseDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  actualCloseDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rootCause?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recommendations: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logicTree?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  evidence: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  teamCharter?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  eventDiagram?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  preFailureRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  postFailureRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  failureCostPerIncident?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  implementationCost?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeToResolution?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeToImplementation?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  effectivenessScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  lastUpdated?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  trackingNotes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phaseTimeline?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  calculatedROI?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  costSavings?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  downtimeReduction?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  productivityImprovement?: number;
} 