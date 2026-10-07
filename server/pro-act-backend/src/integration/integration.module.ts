import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationController } from './integration.controller';
import { PIBrowserController } from './pi-browser.controller';
import { PIEventPullService } from './pi-event-pull.service';
import { PIWebApiService } from './pi-web-api.service';
import { MasterDataCodeResolverService } from './master-data-code-resolver.service';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PIEvent } from '../pi-event/pi-event.entity';
import { PIMapping } from '../pi-mapping/pi-mapping.entity';
import { AfBinding } from '../af-binding/af-binding.entity';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { HierarchyMappingModule } from '../hierarchy-mapping/hierarchy-mapping.module';
import { UnmappedEventModule } from '../unmapped-event/unmapped-event.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PIConnection,
      PIEvent,
      PIMapping,
      AfBinding,
      PISyncWatermark,
      ProductionEvent,
      ProductionPlan,
      ReasonCode,
      ImpactCode,
      OEECode,
    ]),
    ProductionEventModule,
    HierarchyMappingModule,
    UnmappedEventModule,
  ],
  controllers: [IntegrationController, PIBrowserController],
  providers: [PIEventPullService, PIWebApiService, MasterDataCodeResolverService],
  exports: [PIEventPullService, PIWebApiService, MasterDataCodeResolverService],
})
export class IntegrationModule {}
