import { PartialType } from '@nestjs/swagger';
import { CreatePIEventDto } from './create-pi-event.dto';

export class UpdatePIEventDto extends PartialType(CreatePIEventDto) {}

