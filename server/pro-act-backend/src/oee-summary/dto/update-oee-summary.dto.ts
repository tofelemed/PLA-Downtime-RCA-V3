import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class UpdateOeeSummaryDto {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  planId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  period?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  oee?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  availability?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  performance?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  quality?: number;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
} 