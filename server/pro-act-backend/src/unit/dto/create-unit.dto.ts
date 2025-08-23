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

  @ApiProperty()
  @IsNumber()
  capacity: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unitOfMeasure: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  idealCycleTime?: number;

  @ApiProperty()
  @IsUUID()
  tenantId: string;
} 