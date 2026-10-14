import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

/** Records that carry custom attribute values in the v2 API (the master data records of a plant). */
export const VALUE_ENTITY_TYPES = ['Unit', 'Asset'] as const;
export type ValueEntityType = (typeof VALUE_ENTITY_TYPES)[number];

/** `GET /v2/custom-attribute-values`: the values of one unit or asset. */
export class AttributeValuesQueryDto {
  @ApiProperty({ enum: VALUE_ENTITY_TYPES })
  @IsIn(VALUE_ENTITY_TYPES)
  entityType!: ValueEntityType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  entityId!: string;
}

/** `PUT /v2/custom-attribute-values`: sets (creates or replaces) one value of a unit or asset. */
export class SetAttributeValueDto extends AttributeValuesQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  attributeDefinitionId!: string;

  @ApiProperty({
    maxLength: 4000,
    description: 'The value as text; empty clears it',
  })
  @IsString()
  @MaxLength(4000)
  value!: string;
}

/** One stored value of a record. */
export interface AttributeValueV2View {
  attributeDefinitionId: string;
  value: string;
  updatedAt: string;
}
