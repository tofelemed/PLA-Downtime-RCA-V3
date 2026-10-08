import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  unitOfMeasure?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  standardCost?: number;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(36)
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(36)
  @IsOptional()
  organizationId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(36)
  @IsOptional()
  unitId?: string;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
