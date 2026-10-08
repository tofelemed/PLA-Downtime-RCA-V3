import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Unit } from '../unit/unit.entity';
import { CalendarMaterializationJob } from './calendar-materialization.job';
import { CalendarMaterializerService } from './calendar-materializer.service';
import { CalendarPreviewService } from './calendar-preview.service';
import { CalendarPublishService } from './calendar-publish.service';
import { CalendarVersionsService } from './calendar-versions.service';
import { CalendarService } from './calendar.service';
import { CrewRotationsLoader } from './crew-rotations.loader';
import { CrewsService } from './crews.service';
import { CalendarVersion } from './entities/calendar-version.entity';
import { CrewRotation } from './entities/crew-rotation.entity';
import { Crew } from './entities/crew.entity';
import { ShiftInstance } from './entities/shift-instance.entity';
import { Site } from './entities/site.entity';
import { ShiftLabelsService } from './shift-labels.service';
import { SitesService } from './sites.service';

/**
 * Calendars and shift instances of plan 2.1 (CAL01, CAL02): sites, versioned calendars, publication and
 * materialization of shift instances (hourly top-up job in worker/all processes), crews, previews,
 * schedule queries for downtime/accounting and the v1 shift-label bridge.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Site,
      CalendarVersion,
      ShiftInstance,
      Crew,
      CrewRotation,
      Unit,
      Tenant,
    ]),
  ],
  providers: [
    SitesService,
    CalendarVersionsService,
    CalendarPublishService,
    CalendarMaterializerService,
    CalendarPreviewService,
    CalendarService,
    CrewRotationsLoader,
    CrewsService,
    ShiftLabelsService,
    CalendarMaterializationJob,
  ],
  exports: [
    SitesService,
    CalendarVersionsService,
    CalendarPublishService,
    CalendarMaterializerService,
    CalendarPreviewService,
    CalendarService,
    CrewsService,
    ShiftLabelsService,
  ],
})
export class CalendarModule {}
