import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsArray } from 'class-validator';

export class UpdateReconcileFormDto {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  planId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  period?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  categories?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
} 