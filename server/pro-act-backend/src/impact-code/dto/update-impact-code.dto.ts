import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class UpdateImpactCodeDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  costPerUnit?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  costPerHour?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  costBasis?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
}