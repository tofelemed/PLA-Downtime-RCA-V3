import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PISyncJob } from '../pi-sync-job/pi-sync-job.entity';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PIEventPullService } from '../integration/pi-event-pull.service';

interface SyncJobConfigExtras {
  intervalMinutes?: number;
  lookbackMinutes?: number;
  autoStart?: boolean;
  syncedEventCount?: number;
  errorCount?: number;
  scopeType?: 'database' | 'element';
  scopeId?: string;
  templateName?: string;
  maxCount?: number;
  lastRun?: string;
  lastSuccess?: string;
  lastError?: string;
  nextRun?: string;
}

@Injectable()
export class PISyncSchedulerService {
  private readonly logger = new Logger(PISyncSchedulerService.name);
  private readonly runningJobs = new Set<string>();

  constructor(
    @InjectRepository(PISyncJob)
    private readonly piSyncJobRepository: Repository<PISyncJob>,
    @InjectRepository(PISyncWatermark)
    private readonly piSyncWatermarkRepository: Repository<PISyncWatermark>,
    @InjectRepository(PIConnection)
    private readonly piConnectionRepository: Repository<PIConnection>,
    private readonly piEventPullService: PIEventPullService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledSyncs(): Promise<void> {
    const jobs = await this.piSyncJobRepository.find({
      where: { isActive: true },
    });

    const dueJobs = jobs.filter((job) => this.isJobDue(job));
    if (dueJobs.length === 0) return;

    this.logger.log(`Running ${dueJobs.length} due PI sync job(s)`);

    for (const job of dueJobs) {
      if (!job.tenantId) continue;
      await this.runJob(job);
    }
  }

  async runJob(job: PISyncJob): Promise<void> {
    if (!job.tenantId) return;
    if (this.runningJobs.has(job.id)) {
      this.logger.warn(`PI sync job ${job.id} already running, skipping`);
      return;
    }

    this.runningJobs.add(job.id);
    const startedAt = new Date();

    try {
      const extras = this.parseJobConfig(job.jobConfig);
      const connection = await this.piConnectionRepository.findOne({
        where: { tenantId: job.tenantId, isActive: true },
      });

      if (!connection) {
        throw new Error(`No active PI connection for tenant ${job.tenantId}`);
      }

      const { scopeType, scopeId } = this.resolveScope(connection, extras);
      const endTimeUtc = new Date().toISOString();
      const startTimeUtc = await this.resolveStartTime(job.tenantId, scopeType, scopeId, extras);

      const result = await this.piEventPullService.pullEvents({
        tenantId: job.tenantId,
        startTimeUtc,
        endTimeUtc,
        scopeType,
        scopeId,
        templateName: extras.templateName,
        maxCount: extras.maxCount || 500,
        autoCreateProductionEvents: true,
      });

      const intervalMinutes = extras.intervalMinutes || this.parseIntervalFromSchedule(job.schedule) || 15;
      const nextRun = new Date(Date.now() + intervalMinutes * 60 * 1000);

      const updatedExtras: SyncJobConfigExtras = {
        ...extras,
        intervalMinutes,
        lookbackMinutes: extras.lookbackMinutes || 60,
        syncedEventCount: (extras.syncedEventCount || 0) + result.productionEventsCreated,
        errorCount: result.success ? extras.errorCount || 0 : (extras.errorCount || 0) + 1,
        lastRun: startedAt.toISOString(),
        lastSuccess: result.success ? startedAt.toISOString() : extras.lastSuccess,
        lastError: result.success ? undefined : result.errors.join('; '),
        nextRun: nextRun.toISOString(),
      };

      await this.piSyncJobRepository.update(job.id, {
        lastRunTime: startedAt,
        nextRunTime: nextRun,
        status: result.success ? 'success' : 'error',
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        jobConfig: JSON.stringify(updatedExtras),
      });

      this.logger.log(
        `PI sync job ${job.id} complete: fetched=${result.eventsFetched}, created=${result.productionEventsCreated}, updated=${result.productionEventsUpdated}, skipped=${result.productionEventsSkipped}, unmapped=${result.unmappedEventsCreated}`,
      );
    } catch (error: any) {
      this.logger.error(`PI sync job ${job.id} failed: ${error.message}`);
      const extras = this.parseJobConfig(job.jobConfig);
      const intervalMinutes = extras.intervalMinutes || 15;
      await this.piSyncJobRepository.update(job.id, {
        lastRunTime: startedAt,
        nextRunTime: new Date(Date.now() + intervalMinutes * 60 * 1000),
        status: 'error',
        errorMessage: error.message,
      });
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  private isJobDue(job: PISyncJob): boolean {
    if (!job.isActive) return false;
    if (job.jobType && job.jobType !== 'pi-event-sync') return false;

    const now = Date.now();
    if (job.nextRunTime && job.nextRunTime.getTime() <= now) return true;

    const extras = this.parseJobConfig(job.jobConfig);
    const intervalMinutes = extras.intervalMinutes || this.parseIntervalFromSchedule(job.schedule) || 15;
    if (!job.lastRunTime) return true;

    const nextDue = job.lastRunTime.getTime() + intervalMinutes * 60 * 1000;
    return nextDue <= now;
  }

  private parseJobConfig(jobConfig?: string | null): SyncJobConfigExtras & Record<string, any> {
    if (!jobConfig) return {};
    try {
      return JSON.parse(jobConfig);
    } catch {
      return {};
    }
  }

  private parseIntervalFromSchedule(schedule?: string | null): number | null {
    if (!schedule) return null;
    const match = schedule.match(/^\*\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private resolveScope(connection: PIConnection, extras: SyncJobConfigExtras) {
    const config = connection.connectionConfig ? JSON.parse(connection.connectionConfig) : {};
    const scopeType = extras.scopeType || (config.databaseWebId ? 'database' : 'element');
    const scopeId =
      extras.scopeId ||
      config.databaseWebId ||
      config.elementWebId ||
      config.afDatabase?.webId ||
      config.afRootElement?.webId;

    if (!scopeId) {
      throw new Error('No PI sync scope configured (database or element WebId)');
    }

    return { scopeType: scopeType as 'database' | 'element', scopeId };
  }

  private async resolveStartTime(
    tenantId: string,
    scopeType: 'database' | 'element',
    scopeId: string,
    extras: SyncJobConfigExtras,
  ): Promise<string> {
    const watermark = await this.piSyncWatermarkRepository.findOne({
      where: { tenantId, syncType: scopeType, lastSyncMarker: scopeId },
    });

    if (watermark?.lastSyncTimestamp) {
      return watermark.lastSyncTimestamp.toISOString();
    }

    const lookbackMinutes = extras.lookbackMinutes || 60;
    return new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
  }
}
