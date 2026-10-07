import { PartialType } from '@nestjs/swagger';
import { CreateCustomAttributeValueDto } from './create-custom-attribute-value.dto';

export class UpdateCustomAttributeValueDto extends PartialType(CreateCustomAttributeValueDto) {}

