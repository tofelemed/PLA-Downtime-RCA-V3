import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class UpdateProductionLossDto {
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
  actual?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  shortRangePlan?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  losses?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  unaccountedLoss?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
} 