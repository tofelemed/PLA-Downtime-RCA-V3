import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class CreateOEESummaryDto {
  @ApiProperty()
  @IsUUID()
  planId: string;

  @ApiProperty()
  @IsNumber()
  availability: number;

  @ApiProperty()
  @IsNumber()
  performance: number;

  @ApiProperty()
  @IsNumber()
  quality: number;

  @ApiProperty()
  @IsNumber()
  overallOEE: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  period: string;

  @ApiProperty()
  @IsUUID()
  tenantId: string;
} 