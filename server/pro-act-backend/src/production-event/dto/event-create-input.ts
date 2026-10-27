import { EventWriteInput } from '../event-write-model';
import { CreateProductionEventDto } from './create-production-event.dto';

/**
 * What a server-side writer (a connector) creates an event from: the v1 body's fields (the legacy status
 * optional) plus the v2 write-model fields the v1 body does not carry — the classification, the declared
 * figures and the quantity's unit of measure. The v1 DTO itself is one.
 */
export type EventCreateInput = Omit<CreateProductionEventDto, 'status'> &
  Pick<EventWriteInput, 'classification' | 'declaredFigures'> & {
    status?: string;
    quantityUom?: string;
  };
