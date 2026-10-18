import { PartialType } from '@nestjs/swagger';
import { CreateSourceHierarchyMappingDto } from './create-source-hierarchy-mapping.dto';

export class UpdateSourceHierarchyMappingDto extends PartialType(
  CreateSourceHierarchyMappingDto,
) {}
