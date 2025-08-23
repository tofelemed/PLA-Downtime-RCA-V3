import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsNumber, IsDate, IsBoolean } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsUUID()
  assignedTo: string;

  @ApiProperty()
  @IsUUID()
  assignedBy: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  priority: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ required: false })
  @IsDate()
  @IsOptional()
  dueDate?: Date;

  @ApiProperty({ required: false })
  @IsDate()
  @IsOptional()
  completedDate?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  tenantId: string;
} 