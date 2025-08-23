import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsNumber, IsNotEmpty } from 'class-validator';

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

  @ApiProperty()
  @IsUUID()
  tenantId: string;
} 