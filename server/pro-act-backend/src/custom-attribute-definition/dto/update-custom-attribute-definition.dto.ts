import { PartialType } from '@nestjs/swagger';
import { CreateCustomAttributeDefinitionDto } from './create-custom-attribute-definition.dto';

export class UpdateCustomAttributeDefinitionDto extends PartialType(CreateCustomAttributeDefinitionDto) {}

