import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import { MasterDataListQueryDto } from '../master-data/common/master-data-list-query.dto';
import { trimmed } from '../units/unit-v2.dto';

/** Cause categories of the RCA cause library and the template logic trees (v1 values, 6M). */
export const CAUSE_CATEGORIES = [
  'Equipment',
  'Process',
  'Material',
  'Personnel',
  'Environment',
  'Method',
] as const;
export type CauseCategory = (typeof CAUSE_CATEGORIES)[number];

/** One node of a template's logic tree (stored in `rca_templates.template_data`). */
export class LogicTreeNodeDto {
  @ApiProperty({
    maxLength: 64,
    description: 'Client-generated node id, unique in the tree',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiProperty({ enum: CAUSE_CATEGORIES })
  @IsIn(CAUSE_CATEGORIES)
  category: CauseCategory;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Kept from v1 templates',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'Kept from v1 templates' })
  @IsOptional()
  @IsBoolean()
  finding?: boolean;

  @ApiPropertyOptional({ type: () => [LogicTreeNodeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LogicTreeNodeDto)
  children?: LogicTreeNodeDto[];
}

class RcaTemplateV2FieldsDto {
  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    type: [LogicTreeNodeDto],
    description: 'Top-level nodes; at most 500 nodes, 12 levels',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LogicTreeNodeDto)
  logicTree?: LogicTreeNodeDto[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Active verification checklists of the plant',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  checklistIds?: string[];
}

export class RcaTemplateV2CreateDto extends RcaTemplateV2FieldsDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ maxLength: 100, example: 'Equipment failure' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;
}

export class RcaTemplateV2ChangeDto extends RcaTemplateV2FieldsDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category?: string;
}

export class RcaCauseV2ListQueryDto extends MasterDataListQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Direct sub-causes of this cause',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ default: false, description: 'Top-level causes only' })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  rootsOnly?: boolean;
}

class CodedFieldsDto {
  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class RcaCauseV2CreateDto extends CodedFieldsDto {
  @ApiProperty({ maxLength: 100 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: CAUSE_CATEGORIES })
  @IsIn(CAUSE_CATEGORIES)
  category: CauseCategory;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Parent cause (null = top level)',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class RcaCauseV2ChangeDto extends CodedFieldsDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: CAUSE_CATEGORIES })
  @IsOptional()
  @IsIn(CAUSE_CATEGORIES)
  category?: CauseCategory;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Move under this cause; null = top level',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

class ChecklistFieldsDto extends CodedFieldsDto {
  @ApiPropertyOptional({
    nullable: true,
    example: '#3B82F6',
    description: 'Badge colour, #RRGGBB',
  })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a colour like #3B82F6' })
  color?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Checklist items in order (at most 100)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(500, { each: true })
  items?: string[];
}

export class VerificationChecklistV2CreateDto extends ChecklistFieldsDto {
  @ApiProperty({ maxLength: 100 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}

export class VerificationChecklistV2ChangeDto extends ChecklistFieldsDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}
