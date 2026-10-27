import { Module } from '@nestjs/common';
import { AttributeMappingModule } from '../../../attribute-mapping/attribute-mapping.module';
import { OutboxModule } from '../../../common/outbox/outbox.module';
import { IntegrationModule } from '../../../integration/integration.module';
import { SourceMappingModule } from '../../../source-mapping/source-mapping.module';
import { ProductionEventModule } from '../../../production-event/production-event.module';
import { IntakeModule } from '../../intake.module';
import { MqttDowntimeFeedHandler } from './handlers/mqtt-downtime-feed.handler';
import { MqttIntervalEventHandler } from './handlers/mqtt-interval-event.handler';
import { MqttPlaFeedHandler } from './handlers/mqtt-pla-feed.handler';
import { MqttStateHandler } from './handlers/mqtt-state.handler';
import { MqttSubscriberHost } from './host/mqtt-subscriber-host';
import { MqttSubscriberHostJob } from './host/mqtt-subscriber-host.job';
import { MqttAdapter } from './mqtt.adapter';

/**
 * MQTT intake (plan 1.8): the adapter (config, test, discover), the worker-side subscriber host with
 * its clock (active where schedulers run), and the normalisers of MQTT interval events (through the PI
 * frame path) and states (availability → source health; machine state → state signal samples). Measurements
 * are handled by `MeasurementHandler` (signals module), retractions by `RetractionHandler` (intake).
 */
@Module({
  imports: [
    IntakeModule,
    OutboxModule,
    IntegrationModule,
    SourceMappingModule,
    AttributeMappingModule,
    ProductionEventModule,
  ],
  providers: [
    MqttAdapter,
    MqttSubscriberHost,
    MqttSubscriberHostJob,
    MqttIntervalEventHandler,
    MqttStateHandler,
    MqttDowntimeFeedHandler,
    MqttPlaFeedHandler,
  ],
  exports: [MqttAdapter, MqttSubscriberHost],
})
export class MqttAdapterModule {}
