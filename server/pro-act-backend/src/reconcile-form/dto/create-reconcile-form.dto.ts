import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateReconcileFormDto {
  @ApiProperty()
  @IsUUID()
  lossId: string;

  @ApiProperty()
  @IsNumber()
  totalLossAmount: number;

  @ApiProperty()
  @IsNumber()
  categorizedLossAmount: number;

  @ApiProperty()
  @IsNumber()
  unaccountedLossAmount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productionEvent: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  comment: string;

  @ApiProperty({ enum: ['Draft', 'Submitted', 'Approved', 'Rejected'] })
  @IsString()
  status: string;

  @ApiProperty()
  @IsString()
  categories: string;

  @ApiProperty()
  @IsUUID()
  tenantId: string;
} 