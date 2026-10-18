import { PartialType } from '@nestjs/swagger';
import { CreateUnmappedEventDto } from './create-unmapped-event.dto';

export class UpdateUnmappedEventDto extends PartialType(
  CreateUnmappedEventDto,
) {}
