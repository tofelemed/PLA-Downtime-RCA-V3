import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  DURATION_UNITS,
  DurationUnit,
  FIELD_VALUE_TYPES,
  FieldValueType,
} from '../../attribute-mapping/field-rule';

export class FieldRuleDto {
  @ApiProperty({ description: 'Attribute name as delivered (case-sensitive)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sourceAttr: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Further attribute names tried in order',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  aliases?: string[];

  @ApiProperty({ description: 'A field of GET /api/v2/field-catalog' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  targetField: string;

  @ApiProperty({ enum: FIELD_VALUE_TYPES })
  @IsIn(FIELD_VALUE_TYPES)
  type: FieldValueType;

  @ApiPropertyOptional({
    enum: DURATION_UNITS,
    description: 'Required for duration rules',
  })
  @IsOptional()
  @IsIn(DURATION_UNITS)
  unit?: DurationUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

/** Body of POST /attribute-mappings: the next version of a template's tenant override. */
export class AttributeMappingV2CreateDto {
  @ApiProperty({
    description: "PI template name ('*NoTemplate*' for frames without one)",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  templateName: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Connection the override applies to (default: all)',
  })
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @ApiProperty({
    type: [FieldRuleDto],
    description:
      'Merged field by field over the catalog defaults (only the listed target fields change)',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => FieldRuleDto)
  fieldRules: FieldRuleDto[];

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Start of validity (default now)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveFrom?: string;
}
