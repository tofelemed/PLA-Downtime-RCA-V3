import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateRcaTemplateDto {
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
  category?: string;

  @ApiProperty({ type: Object, required: false })
  @IsObject()
  @IsOptional()
  logicTreeStructure?: Record<string, any>;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  verificationChecklist?: string[];

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
}