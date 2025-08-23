import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsDate, IsEnum } from 'class-validator';

export class CreateAssetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  assetType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  criticality: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  installationDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  lastMaintenanceDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  nextMaintenanceDate?: Date;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty()
  @IsUUID()
  tenantId: string;
} 