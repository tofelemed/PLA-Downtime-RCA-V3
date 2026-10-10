import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsArray, IsNumber, IsDateString, ValidateBy } from 'class-validator';

/** JSON text (v1 clients) or the array itself (the service serializes it; plan 3.9). */
function IsJsonTextOrArray(): PropertyDecorator {
  return ValidateBy({
    name: 'isJsonTextOrArray',
    validator: {
      validate: (value: unknown) => typeof value === 'string' || Array.isArray(value),
      defaultMessage: () => '$property must be JSON text or an array',
    },
  });
}
import { Type } from 'class-transformer';

export class CreateRcaDto {
  @ApiProperty({ required: false, description: 'Optional since 3.9: a case may start without an event' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['Draft', 'In Progress', 'Analysis', 'Published', 'Closed'] })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  teamLeadId?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  teamMemberIds?: string[];

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

  @ApiProperty({ required: false, description: 'JSON text or array' })
  @IsOptional()
  @IsJsonTextOrArray()
  recommendations?: string | unknown[];

  @ApiProperty({ required: false, description: 'JSON text or array' })
  @IsOptional()
  @IsJsonTextOrArray()
  logicTree?: string | unknown[];

  @ApiProperty({ required: false, description: 'JSON text or array' })
  @IsOptional()
  @IsJsonTextOrArray()
  evidence?: string | unknown[];

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