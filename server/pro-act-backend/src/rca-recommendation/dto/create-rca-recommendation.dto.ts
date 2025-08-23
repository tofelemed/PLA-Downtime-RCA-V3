import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsUUID, IsDate, IsNumber } from 'class-validator';

export class CreateRCARecommendationDto {
  @ApiProperty()
  @IsUUID()
  rcaId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: ['Low', 'Medium', 'High'] })
  @IsEnum(['Low', 'Medium', 'High'])
  priority: string;

  @ApiProperty()
  @IsUUID()
  assigneeId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  dueDate?: Date;

  @ApiProperty({ enum: ['Open', 'In Progress', 'Completed', 'Cancelled'] })
  @IsEnum(['Open', 'In Progress', 'Completed', 'Cancelled'])
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cmmsWorkOrderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  actualCost?: number;
} 