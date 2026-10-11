import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PISyncJob } from '../pi-sync-job/pi-sync-job.entity';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PiLegacyJobLink } from '../integration/pi/pi-legacy-job-link';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';

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

/** PI05 default poll when a v1 job does not set its own interval. */
const DEFAULT_POLL_SECONDS = 60;

/**
 * v1 PI sync jobs on the certified intake (plan 1.6 step 5): every minute each due, active v1 job is
 * linked to its leased ingestion jobs (`PiLegacyJobLink`, created from the v1 scope, template, interval
 * and watermark) and the ingestion job's status is written back to the v1 row for the v1 screens. The
 * pull itself runs in the worker's job runner (paging, checkpoints, retries); "run now" makes the
 * linked window job due at once.
 */
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
    private readonly link: PiLegacyJobLink,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  // Only fires where ScheduleModule is loaded (PROCESS_ROLE=worker|all, see SchedulerModule)
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledSyncs(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;

    const jobs = await this.piSyncJobRepository.find({
      where: { isActive: true },
    });

    const dueJobs = jobs.filter((job) => this.isJobDue(job));
    if (dueJobs.length === 0) return;

    this.logger.log(`Running ${dueJobs.length} due PI sync job(s)`);

    for (const job of dueJobs) {
      if (this.shutdown.isShuttingDown) {
        this.logger.log(
          'Shutdown in progress: remaining due PI sync jobs run after the next start',
        );
        return;
      }
      if (!job.tenantId) continue;
      await this.runJob(job);
    }
  }

  /** Links the v1 job (and with `runNow`, makes its window job due immediately). */
  async runJob(job: PISyncJob, runNow = false): Promise<void> {
    if (!job.tenantId) return;
    if (this.runningJobs.has(job.id)) {
      this.logger.warn(`PI sync job ${job.id} already running, skipping`);
      return;
    }

    this.runningJobs.add(job.id);
    // Tracked so SIGTERM waits for the link to finish before the DB connection closes (ING02).
    await this.shutdown.track(this.executeJob(job, job.tenantId, runNow));
  }

  private async executeJob(
    job: PISyncJob,
    tenantId: string,
    runNow: boolean,
  ): Promise<void> {
    const startedAt = new Date();

    try {
      const extras = this.parseJobConfig(job.jobConfig);
      const connection = await this.piConnectionRepository.findOne({
        where: { tenantId, isActive: true },
      });

      if (!connection) {
        throw new Error(`No active PI connection for tenant ${tenantId}`);
      }

      const { scopeType, scopeId } = this.resolveScope(connection, extras);
      const linked = await this.link.link({
        piSyncJobId: job.id,
        tenantId,
        piConnection: connection,
        search: { scopeType, scopeId, templateName: extras.templateName },
        intervalSeconds: this.intervalSeconds(job, extras),
        lookbackMinutes: extras.lookbackMinutes || 60,
        watermark: await this.watermarkOf(tenantId, scopeType, scopeId),
      });
      if (runNow) await this.link.runNow(job.id);

      await this.piSyncJobRepository.update(job.id, {
        lastRunTime: linked.lastSuccessAt ?? undefined,
        nextRunTime: runNow ? startedAt : (linked.nextRunAt ?? undefined),
        status: linked.state === 'failed' ? 'error' : 'success',
        errorMessage: linked.lastError ?? (() => 'NULL'),
      });
    } catch (error: unknown) {
      await this.recordFailure(job, startedAt, error);
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  private async recordFailure(
    job: PISyncJob,
    startedAt: Date,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`PI sync job ${job.id} failed: ${message}`);
    const extras = this.parseJobConfig(job.jobConfig);
    const intervalMinutes = extras.intervalMinutes || 15;
    await this.piSyncJobRepository.update(job.id, {
      lastRunTime: startedAt,
      nextRunTime: new Date(Date.now() + intervalMinutes * 60 * 1000),
      status: 'error',
      errorMessage: message,
    });
  }

  private isJobDue(job: PISyncJob): boolean {
    if (!job.isActive) return false;
    if (job.jobType && job.jobType !== 'pi-event-sync') return false;

    const now = Date.now();
    if (job.nextRunTime && job.nextRunTime.getTime() <= now) return true;

    const extras = this.parseJobConfig(job.jobConfig);
    const intervalMinutes =
      extras.intervalMinutes ||
      this.parseIntervalFromSchedule(job.schedule) ||
      15;
    if (!job.lastRunTime) return true;

    const nextDue = job.lastRunTime.getTime() + intervalMinutes * 60 * 1000;
    return nextDue <= now;
  }

  private parseJobConfig(jobConfig?: string | null): SyncJobConfigExtras {
    if (!jobConfig) return {};
    try {
      const parsed: unknown = JSON.parse(jobConfig);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  private parseIntervalFromSchedule(schedule?: string | null): number | null {
    if (!schedule) return null;
    const match = schedule.match(/^\*\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private resolveScope(
    connection: PIConnection,
    extras: SyncJobConfigExtras,
  ): { scopeType: 'database' | 'element'; scopeId: string } {
    const config = connectionSettings(connection.connectionConfig);
    const scopeType =
      extras.scopeType || (config.databaseWebId ? 'database' : 'element');
    const scopeId =
      extras.scopeId ||
      config.databaseWebId ||
      config.elementWebId ||
      config.afDatabase?.webId ||
      config.afRootElement?.webId;

    if (!scopeId) {
      throw new Error(
        'No PI sync scope configured (database or element WebId)',
      );
    }

    return { scopeType, scopeId };
  }

  private intervalSeconds(job: PISyncJob, extras: SyncJobConfigExtras): number {
    const minutes =
      extras.intervalMinutes || this.parseIntervalFromSchedule(job.schedule);
    return minutes ? minutes * 60 : DEFAULT_POLL_SECONDS;
  }

  /** The v1 watermark of the scope: where a newly linked window job starts (no gap, no re-read). */
  private async watermarkOf(
    tenantId: string,
    scopeType: 'database' | 'element',
    scopeId: string,
  ): Promise<Date | null> {
    const watermark = await this.piSyncWatermarkRepository.findOne({
      where: { tenantId, syncType: scopeType, lastSyncMarker: scopeId },
    });
    return watermark?.lastSyncTimestamp ?? null;
  }
}

/** The scope settings a v1 connection's JSON config may carry. */
interface ConnectionScopeSettings {
  databaseWebId?: string;
  elementWebId?: string;
  afDatabase?: { webId?: string };
  afRootElement?: { webId?: string };
}

function connectionSettings(json?: string | null): ConnectionScopeSettings {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
