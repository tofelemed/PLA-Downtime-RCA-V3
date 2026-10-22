import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarModule } from '../../calendar/calendar.module';
import { Site } from '../../calendar/entities/site.entity';
import { SitesV2Controller } from './sites-v2.controller';
import { SitesV2Service } from './sites-v2.service';

/**
 * Sites on `/api/v2/sites` (DECISIONS 2026-10-22 "Site level is exposed"). Imported by `V2Module` and
 * included in the v2 OpenAPI document (`openapi-v2.ts`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Site]), CalendarModule],
  controllers: [SitesV2Controller],
  providers: [SitesV2Service],
  // GET /v2/sites lives on the calendar schedule controller and the session bootstrap (V2Module)
  exports: [SitesV2Service],
})
export class SitesV2Module {}
