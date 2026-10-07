import { PartialType } from '@nestjs/swagger';
import { CreatePIMappingDto } from './create-pi-mapping.dto';

export class UpdatePIMappingDto extends PartialType(CreatePIMappingDto) {}

