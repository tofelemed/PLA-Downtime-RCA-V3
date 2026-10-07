import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class CreateImpactCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, enum: ['Quality', 'Availability', 'Performance'] })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  costPerUnit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  costPerHour?: number;

  @ApiProperty({ required: false, enum: ['perUnit', 'perHour'] })
  @IsString()
  @IsOptional()
  costBasis?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  severity?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
} 