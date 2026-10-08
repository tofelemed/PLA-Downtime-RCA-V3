import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationController } from './integration.controller';
import { PIBrowserController } from './pi-browser.controller';
import { PIEventPullService } from './pi-event-pull.service';
import { PIWebApiService } from './pi-web-api.service';
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
    ]),
    ProductionEventModule,
    UnmappedEventModule,
    SourceMappingModule,
    AttributeMappingModule,
    CodeLibraryModule,
  ],
  controllers: [IntegrationController, PIBrowserController],
  providers: [
    PIEventPullService,
    PIWebApiService,
    MasterDataCodeResolverService,
    PiFrameIngestService,
    PiUnmappedRecorder,
  ],
  exports: [PIEventPullService, PIWebApiService, MasterDataCodeResolverService],
})
export class IntegrationModule {}
