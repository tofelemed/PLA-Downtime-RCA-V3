import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterDataCodeResolverService } from './master-data-code-resolver.service';
import { PiFrameIngestService } from './pi-frame-ingest.service';
import { PiUnmappedRecorder } from './pi-unmapped-recorder';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PIEvent } from '../pi-event/pi-event.entity';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { UnmappedEventModule } from '../unmapped-event/unmapped-event.module';
import { SourceMappingModule } from '../source-mapping/source-mapping.module';
import { AttributeMappingModule } from '../attribute-mapping/attribute-mapping.module';
import { CodeLibraryModule } from '../code-library/code-library.module';
import { IntakeModule } from '../intake/intake.module';
import { RulesModule } from '../rules/rules.module';
import { PiIntakeBridge } from './pi-intake-bridge';
import { PiIntervalHandler } from './pi-interval.handler';
import { PiWebApiAdapter } from './pi-web-api.adapter';
import { PiPageManifest } from './pi/entities/pi-page-manifest.entity';
import { PiOpenFrame } from './pi/entities/pi-open-frame.entity';
import { PiSyncJobLink } from './pi/entities/pi-sync-job-link.entity';
import { PiClientFactory } from './pi/pi-client-factory';
import { PiFrameReader } from './pi/pi-frame-reader';
import { PiInventory } from './pi/pi-inventory';
import { PiLegacyJobLink } from './pi/pi-legacy-job-link';
import { PiManifestStore } from './pi/pi-manifest-store';
import { PiOpenFrameRefresh } from './pi/pi-open-frame-refresh';
import { PiOpenFrameStore } from './pi/pi-open-frame-store';
import { PiWindowFetch } from './pi/pi-window-fetch';
import { PiWindowRead } from './pi/pi-window-read';
import { PiRecordedRead } from './pi/pi-recorded-read';
import { PiSignalRead } from './pi/pi-signal-read';
import { PiStreamUpdates } from './pi/pi-stream-updates';
import { PiSummaryRead } from './pi/pi-summary-read';
import { SignalsModule } from '../signals/signals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PIConnection,
      PIEvent,
      PISyncWatermark,
      ProductionEvent,
      ProductionPlan,
      ReasonCode,
      ImpactCode,
      OEECode,
      PiPageManifest,
      PiOpenFrame,
      PiSyncJobLink,
    ]),
    ProductionEventModule,
    UnmappedEventModule,
    SourceMappingModule,
    AttributeMappingModule,
    CodeLibraryModule,
    // active `coding_default` rules applied to created source events (plan 3.8)
    RulesModule,
    // durable intake (plan 1.5): the PI adapter and normaliser register themselves on init
    IntakeModule,
    // signals and the measurement normaliser (plan 1.7)
    SignalsModule,
  ],
  providers: [
    MasterDataCodeResolverService,
    PiFrameIngestService,
    PiUnmappedRecorder,
    PiIntervalHandler,
    PiIntakeBridge,
    PiWebApiAdapter,
    // certified PI read path (plan 1.6)
    PiClientFactory,
    PiFrameReader,
    PiManifestStore,
    PiOpenFrameStore,
    PiWindowRead,
    PiOpenFrameRefresh,
    PiInventory,
    PiWindowFetch,
    PiLegacyJobLink,
    // PI signal jobs (plan 1.7)
    PiSignalRead,
    PiRecordedRead,
    PiSummaryRead,
    PiStreamUpdates,
  ],
  exports: [
    MasterDataCodeResolverService,
    PiLegacyJobLink,
    // the frame → production event path is shared with the MQTT interval-event handler (plan 1.8)
    PiFrameIngestService,
  ],
})
export class IntegrationModule {}
