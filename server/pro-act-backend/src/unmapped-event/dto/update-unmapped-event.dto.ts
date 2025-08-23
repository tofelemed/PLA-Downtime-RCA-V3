import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsDate, IsNumber } from 'class-validator';

export class UpdateUnmappedEventDto {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  planId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  eventType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsDate()
  @IsOptional()
  startTime?: Date;

  @ApiProperty({ required: false })
  @IsDate()
  @IsOptional()
  endTime?: Date;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
} 