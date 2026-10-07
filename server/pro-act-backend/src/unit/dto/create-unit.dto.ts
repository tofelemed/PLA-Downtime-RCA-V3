import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreateUnitDto {
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

  @ApiProperty()
  @IsUUID()
  tenantId: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  organizationId?: string;
} 