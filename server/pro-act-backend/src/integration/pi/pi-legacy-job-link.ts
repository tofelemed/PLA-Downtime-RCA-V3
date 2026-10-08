import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { anonymousContext } from '../../common/context/request-context';
import { IntegrationConnectionService } from '../../intake/connections/integration-connection.service';
import { IngestionJob } from '../../intake/entities/ingestion-job.entity';
import {
  IngestionJobsService,
  scopeHash,
} from '../../intake/jobs/ingestion-jobs.service';
import { PIConnection } from '../../pi-connection/pi-connection.entity';
import { PiSearchScope } from './pi-frame-search';

/** A v1 `pi_sync_jobs` row as the crosswalk needs it. */
export interface LegacyJobSpec {
  piSyncJobId: string;
  tenantId: string;
  piConnection: PIConnection;
  search: PiSearchScope;
  intervalSeconds: number;
  lookbackMinutes: number;
  /** v1 watermark: the first window of a new job starts there (no gap) */
  watermark: Date | null;
}

/** What the v1 job shows of the ingestion job doing its work. */
export interface LinkedJobStatus {
  ingestionJobId: string;
  state: IngestionJob['state'];
  lastSuccessAt: Date | null;
  nextRunAt: Date;
  lastError: string | null;
}

const DAY_SECONDS = 86_400;

/**
 * Plan 1.6 step 5: v1 PI sync jobs no longer pull. Each active v1 job is linked (`pi_sync_job_links`)
 * to a leased `window` ingestion job of the same scope, created from the v1 settings and watermark,
 * plus the connection's recovery jobs with the PI05 defaults: open-frame refresh (60 s), 7-day rescan
 * (daily), 90-day rescan (weekly) and 7-day inventory comparison (daily). Existing jobs of the same
 * connection and scope are reused. The worker's job runner does the reading.
 */
@Injectable()
export class PiLegacyJobLink {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly connections: IntegrationConnectionService,
    private readonly jobs: IngestionJobsService,
  ) {}

  async link(spec: LegacyJobSpec): Promise<LinkedJobStatus> {
    const connection = await this.connections.mirrorPiConnection(
      spec.tenantId,
      spec.piConnection,
    );
    const ensure = (
      scope: Record<string, unknown>,
      intervalSeconds: number,
    ): Promise<string> =>
      this.ensureJob(spec.tenantId, connection.id, { scope, intervalSeconds });
    const search = searchScopeOf(spec.search);
    const windowJobId = await ensure(
      { mode: 'window', ...search, lookbackMinutes: spec.lookbackMinutes },
      spec.intervalSeconds,
    );
    await this.seedCheckpoint(windowJobId, spec.watermark);
    await ensure({ mode: 'open_frames' }, 60);
    await ensure({ mode: 'rescan', ...search, rescanDays: 7 }, DAY_SECONDS);
    await ensure(
      { mode: 'rescan', ...search, rescanDays: 90 },
      7 * DAY_SECONDS,
    );
    await ensure(
      { mode: 'inventory', ...search, inventoryDays: 7 },
      DAY_SECONDS,
    );
    await this.dataSource.query(
      `INSERT INTO "pi_sync_job_links" ("pi_sync_job_id", "tenant_id", "ingestion_job_id") VALUES ($1, $2, $3)
       ON CONFLICT ("pi_sync_job_id") DO UPDATE SET "ingestion_job_id" = EXCLUDED."ingestion_job_id"`,
      [spec.piSyncJobId, spec.tenantId, windowJobId],
    );
    return this.status(windowJobId);
  }

  /** v1 "run now": the linked window job becomes due immediately. */
  async runNow(piSyncJobId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "ingestion_jobs" SET "next_run_at" = now()
        WHERE "id" = (SELECT "ingestion_job_id" FROM "pi_sync_job_links" WHERE "pi_sync_job_id" = $1)`,
      [piSyncJobId],
    );
  }

  /** The running job of this connection and scope, or a new started one (a race reuses the winner). */
  private async ensureJob(
    tenantId: string,
    connectionId: string,
    job: { scope: Record<string, unknown>; intervalSeconds: number },
  ): Promise<string> {
    const existing = await this.findActive(connectionId, job.scope);
    if (existing) return existing;
    const context = { ...anonymousContext('pi-legacy-link'), tenantId };
    try {
      const created = await this.jobs.create(context, connectionId, {
        scope: job.scope,
        cadence: { intervalSeconds: job.intervalSeconds, pageSize: 500 },
        start: true,
      });
      return created.id;
    } catch (error) {
      const raced =
        error instanceof ConflictException &&
        (await this.findActive(connectionId, job.scope));
      if (raced) return raced;
      throw error;
    }
  }

  private async findActive(
    connectionId: string,
    scope: Record<string, unknown>,
  ): Promise<string | null> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT "id" FROM "ingestion_jobs" WHERE "connection_id" = $1 AND "scope_hash" = $2 AND "state" <> 'stopped'`,
      [connectionId, scopeHash(scope)],
    );
    return rows[0]?.id ?? null;
  }

  /** A new window job continues from the v1 watermark instead of the lookback. */
  private async seedCheckpoint(
    jobId: string,
    watermark: Date | null,
  ): Promise<void> {
    if (!watermark) return;
    await this.dataSource.query(
      `UPDATE "ingestion_jobs" SET "committed_cursor" = $2::jsonb
        WHERE "id" = $1 AND "committed_cursor" IS NULL`,
      [
        jobId,
        JSON.stringify({ checkpoint: watermark.toISOString(), window: null }),
      ],
    );
  }

  private async status(jobId: string): Promise<LinkedJobStatus> {
    const job = await this.dataSource.manager.findOneByOrFail(IngestionJob, {
      id: jobId,
    });
    return {
      ingestionJobId: job.id,
      state: job.state,
      lastSuccessAt: job.lastSuccessAt,
      nextRunAt: job.nextRunAt,
      lastError: job.lastError,
    };
  }
}

function searchScopeOf(search: PiSearchScope): Record<string, unknown> {
  return {
    scopeType: search.scopeType,
    scopeId: search.scopeId,
    ...(search.templateName ? { templateName: search.templateName } : {}),
  };
}
