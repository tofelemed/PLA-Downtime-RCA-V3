import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ListQueryDto } from '../../common/list-query.dto';

export const ATTRIBUTE_ENTITY_TYPES = [
  'Organization',
  'Tenant',
  'Unit',
  'Asset',
] as const;
export const ATTRIBUTE_DATA_TYPES = [
  'string',
  'number',
  'boolean',
  'date',
  'select',
] as const;
export type AttributeEntityType = (typeof ATTRIBUTE_ENTITY_TYPES)[number];
export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[number];

/** `GET /v2/custom-attribute-definitions`: definitions that apply in the acting plant, in display order. */
export class AttributeDefinitionsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ATTRIBUTE_ENTITY_TYPES })
  @IsOptional()
  @IsIn(ATTRIBUTE_ENTITY_TYPES)
  entityType?: AttributeEntityType;
}

export class AttributeValidationDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minLength?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Regular expression the text must match',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pattern?: string;
}

/** Fields shared by create and update (all optional on update). */
class AttributeFieldsDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  defaultValue?: string;

  @ApiPropertyOptional({ type: AttributeValidationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AttributeValidationDto)
  validationRules?: AttributeValidationDto;

  @ApiPropertyOptional({
    type: [String],
    description: 'Choices of a select attribute',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  selectOptions?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAttributeDefinitionDto extends AttributeFieldsDto {
  @ApiProperty({ enum: ATTRIBUTE_ENTITY_TYPES })
  @IsIn(ATTRIBUTE_ENTITY_TYPES)
  entityType: AttributeEntityType;

  @ApiProperty({
    maxLength: 100,
    description:
      'Internal name: lowercase letters, digits and underscores, starting with a letter',
  })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  @MaxLength(100)
  name: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName: string;

  @ApiProperty({ enum: ATTRIBUTE_DATA_TYPES })
  @IsIn(ATTRIBUTE_DATA_TYPES)
  dataType: AttributeDataType;
}

export class UpdateAttributeDefinitionDto extends AttributeFieldsDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({ enum: ATTRIBUTE_DATA_TYPES })
  @IsOptional()
  @IsIn(ATTRIBUTE_DATA_TYPES)
  dataType?: AttributeDataType;
}
