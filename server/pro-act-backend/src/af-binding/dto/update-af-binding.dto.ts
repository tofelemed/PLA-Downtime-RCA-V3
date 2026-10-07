import { PartialType } from '@nestjs/swagger';
import { CreateAfBindingDto } from './create-af-binding.dto';

export class UpdateAfBindingDto extends PartialType(CreateAfBindingDto) {}

