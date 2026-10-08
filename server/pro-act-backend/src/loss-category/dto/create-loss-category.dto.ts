import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateLossCategoryDto {
  @ApiProperty()
  @IsUUID()
  reconcileFormId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryName: string;

  @ApiProperty()
  @IsNumber()
  lossAmount: number;

  @ApiProperty()
  @IsUUID()
  impactCodeId: string;

  @ApiProperty()
  @IsUUID()
  oeeCodeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsUUID()
  tenantId: string;
}
