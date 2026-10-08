import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateProductionLossDto {
  @ApiProperty()
  @IsUUID()
  planId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  period: string;

  @ApiProperty()
  @IsNumber()
  actual: number;

  @ApiProperty()
  @IsNumber()
  shortRangePlan: number;

  @ApiProperty()
  @IsNumber()
  losses: number;

  @ApiProperty()
  @IsNumber()
  unaccountedLoss: number;

  @ApiProperty({ enum: ['Reconcile', 'RCA Required', 'Closed'] })
  @IsString()
  action: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lossType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lossCategory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  cost?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUUID()
  tenantId: string;
}
