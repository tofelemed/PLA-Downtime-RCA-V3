import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class UpdateUnitDto {
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
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  capacity?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  unitOfMeasure?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  idealCycleTime?: number;
} 