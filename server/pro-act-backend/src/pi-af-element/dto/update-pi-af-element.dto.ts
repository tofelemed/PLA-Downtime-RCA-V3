import { PartialType } from '@nestjs/swagger';
import { CreatePIAfElementDto } from './create-pi-af-element.dto';

export class UpdatePIAfElementDto extends PartialType(CreatePIAfElementDto) {}

