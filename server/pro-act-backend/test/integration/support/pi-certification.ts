import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  anonymousContext,
  RequestContext,
} from '../../../src/common/context/request-context';
import { OutboxRelayService } from '../../../src/common/outbox/outbox-relay.service';
import { IntegrationConnectionService } from '../../../src/intake/connections/integration-connection.service';
import { IngestionJobsService } from '../../../src/intake/jobs/ingestion-jobs.service';
import {
  JobRunnerService,
  PageOutcome,
} from '../../../src/intake/jobs/job-runner.service';
import { IntegrationHarness } from '../harness';
import {
  PiWebApiSimulator,
  SIM_PASSWORD,
  SIM_USERNAME,
} from '../../simulators/pi-web-api/pi-web-api-simulator';

/** Fast retries against the simulator (production default 500 ms base, 3 attempts). */
export function usePiTestTimings(): void {
  process.env.PI_HTTP_RETRY_BASE_MS = '5';
  process.env.PI_HTTP_MAX_ATTEMPTS = '3';
}

export interface StoredJob {
  state: string;
  committed_cursor: Record<string, unknown> | null;
  retry_count: number;
  last_error: string | null;
  health: Record<string, number>;
}

/** Drives PI ingestion jobs of one tenant against the simulator (plan 1.6 certification suite). */
export class PiJobDriver {
  readonly context: RequestContext;
  connectionId = '';

  constructor(
    private readonly app: INestApplication,
    private readonly harness: IntegrationHarness,
    tenantId: string,
  ) {
    this.context = {
      ...anonymousContext('pi-certification'),
      tenantId,
      userId: randomUUID(),
    };
  }

  /** An `integration_connections` row for the simulator (secret stored encrypted, never in config). */
  async connect(sim: PiWebApiSimulator): Promise<string> {
    const connection = await this.app
      .get(IntegrationConnectionService)
      .create(this.context, {
        sourceType: 'pi_web_api',
        displayName: 'PI simulator',
        endpointConfig: { piWebApiUrl: sim.baseUrl, username: SIM_USERNAME },
        secret: SIM_PASSWORD,
      });
    this.connectionId = connection.id;
    return connection.id;
  }

  async startJob(
    scope: Record<string, unknown>,
    pageSize = 500,
  ): Promise<string> {
    const job = await this.app
      .get(IngestionJobsService)
      .create(this.context, this.connectionId, {
        scope,
        cadence: { intervalSeconds: 60, pageSize },
        start: true,
      });
    return job.id;
  }

  /** Runs one page of `jobId` only (every other due job is deferred). */
  async runPage(jobId: string, owner = 'runner-A'): Promise<PageOutcome> {
    await this.makeOnlyDue(jobId);
    const outcome = await this.app.get(JobRunnerService).runOnce(owner);
    if (!outcome) throw new Error(`job ${jobId} was not claimed`);
    return outcome;
  }

  /** Runs pages of `jobId` until its window is complete; returns every outcome. */
  async runWindow(jobId: string, maxPages = 20): Promise<PageOutcome[]> {
    const outcomes: PageOutcome[] = [];
    for (let page = 0; page < maxPages; page++) {
      const outcome = await this.runPage(jobId);
      outcomes.push(outcome);
      const cursor = (await this.job(jobId)).committed_cursor;
      if (outcome.status !== 'committed' || !cursor?.window) return outcomes;
    }
    throw new Error(`job ${jobId} did not finish its window`);
  }

  async job(jobId: string): Promise<StoredJob> {
    const [row] = await this.harness.dataSource.query<StoredJob[]>(
      `SELECT state, committed_cursor, retry_count, last_error, health FROM ingestion_jobs WHERE id = $1`,
      [jobId],
    );
    return row;
  }

  /** Normalises everything accepted so far (the relay's delivery to the PI handler). */
  async normalizeAll(): Promise<void> {
    const relay = this.app.get(OutboxRelayService);
    while ((await relay.relayBatch()).published > 0);
  }

  private async makeOnlyDue(jobId: string): Promise<void> {
    await this.harness.dataSource.query(
      `UPDATE ingestion_jobs SET next_run_at = CASE WHEN id = $1 THEN now() - interval '1 second'
              ELSE greatest(next_run_at, now() + interval '1 hour') END
        WHERE state IN ('running', 'draining')`,
      [jobId],
    );
  }
}
