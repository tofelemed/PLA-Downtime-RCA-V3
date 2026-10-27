import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { MasterDataV2Module } from './master-data/master-data-v2.module';
import { ReliabilityV2Module } from './reliability/reliability-v2.module';
import { StopEventsV2Module } from './stop-events/stop-events-v2.module';
import { CloseV2Module } from './close/close-v2.module';
import { LossStatementV2Module } from './loss-statement/loss-statement-v2.module';
import { NotificationsV2Module } from './notifications/notifications-v2.module';
import { SitesV2Module } from './sites/sites-v2.module';
import { V2Module } from './v2.module';

/** OpenAPI document of `/api/v2` (V2Module only); served at /api/docs/v2 and snapshotted in `openapi/v2.json`. */
export function buildV2Document(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Traverse Forge API v2')
    .setDescription(
      'Tenant from identity, AND-combined filters, cursor pagination, standard envelopes (src/v2/CONVENTIONS.md). Invalid credentials return 401; unavailable authentication dependencies return retryable 503 SERVICE_UNAVAILABLE without invalidating the session.',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config, {
    include: [
      V2Module,
      MasterDataV2Module,
      ReliabilityV2Module,
      StopEventsV2Module,
      CloseV2Module,
      LossStatementV2Module,
      NotificationsV2Module,
      SitesV2Module,
    ],
  });
}
