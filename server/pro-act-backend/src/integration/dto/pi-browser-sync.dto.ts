import { OmitType } from '@nestjs/swagger';
import { PullEventsDto } from './pull-events.dto';

/** On-demand pull of the tenant named in the route (the tenant comes from the path, I12). */
export class PIBrowserSyncDto extends OmitType(PullEventsDto, [
  'tenantId',
] as const) {}
