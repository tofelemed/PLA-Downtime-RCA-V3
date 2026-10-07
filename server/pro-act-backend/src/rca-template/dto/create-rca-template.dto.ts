import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsArray, IsObject } from 'class-validator';

export class CreateRcaTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ type: Object, required: false, default: {} })
  @IsObject()
  @IsOptional()
  logicTreeStructure?: Record<string, any>;

  @ApiProperty({ type: [String], required: false, default: [] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  verificationChecklist?: string[];

  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  tenantId: string;
}