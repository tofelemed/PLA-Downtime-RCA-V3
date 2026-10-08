import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { addDays } from '../domain/calendar/wall-clock';
import { CalendarMaterializerService } from './calendar-materializer.service';
import { HORIZON_DAYS } from './calendar-publish.service';
import { CalendarVersion } from './entities/calendar-version.entity';
import { Site } from './entities/site.entity';
import { SitesService } from './sites.service';

/**
 * Keeps shift instances generated `HORIZON_DAYS` ahead for every site with a published calendar (plan
 * 2.1 step 4). Gap-fill only: stored instances are never replaced here, so the run is idempotent and
 * safe next to a publication (per-unit advisory locks). Worker/all roles only (SchedulerModule).
 */
@Injectable()
export class CalendarMaterializationJob {
  private readonly logger = new Logger(CalendarMaterializationJob.name);

  constructor(
    @InjectRepository(CalendarVersion)
    private readonly versions: Repository<CalendarVersion>,
    @InjectRepository(Site) private readonly sites: Repository<Site>,
    private readonly siteUnits: SitesService,
    private readonly materializer: CalendarMaterializerService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const written = await this.shutdown.track(this.topUp());
    if (written > 0)
      this.logger.log(`Generated ${written} shift instance(s) ahead`);
  }

  /** Fills missing instances from today to the horizon; returns how many were written. */
  async topUp(now: Date = new Date()): Promise<number> {
    const siteIds = await this.versions
      .createQueryBuilder('v')
      .select('DISTINCT v.siteId', 'siteId')
      .where(`v.state = 'published'`)
      .getRawMany<{ siteId: string }>();
    let written = 0;
    for (const { siteId } of siteIds) {
      if (this.shutdown.isShuttingDown) break;
      written += await this.topUpSite(siteId, now);
    }
    return written;
  }

  private async topUpSite(siteId: string, now: Date): Promise<number> {
    const site = await this.sites.findOneByOrFail({ id: siteId });
    const today = this.materializer.today(site, now);
    try {
      const results = await this.materializer.materialize({
        site,
        unitIds: await this.siteUnits.unitIdsOf(site),
        from: today,
        to: addDays(today, HORIZON_DAYS),
        replaceFrom: null,
        actorId: null,
      });
      return results.reduce((sum, r) => sum + r.insertedInstances, 0);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Shift instances of site ${siteId} not generated: ${message}`,
      );
      return 0;
    }
  }
}
