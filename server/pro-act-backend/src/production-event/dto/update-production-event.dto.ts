import { PartialType } from '@nestjs/swagger';
import { CreateProductionEventDto } from './create-production-event.dto';

export class UpdateProductionEventDto extends PartialType(CreateProductionEventDto) {} 