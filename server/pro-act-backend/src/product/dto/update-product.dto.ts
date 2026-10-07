import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class UpdateProductDto {
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
  unitOfMeasure?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  standardCost?: number;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
}