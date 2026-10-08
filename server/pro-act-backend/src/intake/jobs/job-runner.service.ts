import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  backoffSeconds,
  envInt,
  withTimeout,
} from '../../common/helpers/time-bounds';
import { runnerIdentity } from '../../common/scheduling/runner-identity';
import { adapterErrorOf } from '../adapters/adapter-error';
import { AdapterRegistry } from '../adapters/adapter-registry';
import { ReadPage } from '../adapters/adapter.interface';
import { IntegrationConnectionService } from '../connections/integration-connection.service';
import { IngestionJob } from '../entities/ingestion-job.entity';
import { IntakeService } from '../intake.service';
import {
  claimDueJob,
  ClaimedJob,
  commitPage,
  failPage,
  heartbeat,
  JobLease,
  recordTransition,
} from './job-lease';

/** What one claimed page ended with. */
export type PageOutcome =
  | { status: 'committed'; accepted: number; state: string }
  | { status: 'failed'; error: string; state: string | null }
  | { status: 'lease_lost'; accepted: number };

const HEARTBEAT_EVERY = 50;

/**
 * Leased job runner (plan 1.5 step 4, ING02, FND01). Claims one due job (`claimDueJob`), reads one page
 * from its adapter at the committed cursor (timeout), hands every record to `IntakeService.accept`
 * (heartbeat every 50 records), and only then commits the new cursor and releases the lease. A crash or
 * error before the commit leaves the cursor where it was: the next runner re-reads the page and intake
 * recognises the deliveries already retained (no duplicate source objects). An expired lease of a dead
 * runner is taken over and audited (`lease_reclaimed`).
 */
@Injectable()
export class JobRunnerService {
  private readonly logger = new Logger(JobRunnerService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly adapters: AdapterRegistry,
    private readonly connections: IntegrationConnectionService,
    private readonly intake: IntakeService,
  ) {}

  /** Runs up to `maxJobs` due pages; returns their outcomes. */
  async runDue(owner = runnerIdentity(), maxJobs = 10): Promise<PageOutcome[]> {
    const outcomes: PageOutcome[] = [];
    for (let index = 0; index < maxJobs; index++) {
      const outcome = await this.runOnce(owner);
      if (!outcome) break;
      outcomes.push(outcome);
    }
    return outcomes;
  }

  /** Claims and runs one page of one due job; null when nothing is due. */
  async runOnce(owner = runnerIdentity()): Promise<PageOutcome | null> {
    const lease = await this.claim(owner);
    if (!lease) return null;
    const job = await this.dataSource.manager.findOneByOrFail(IngestionJob, {
      id: lease.jobId,
    });
    try {
      const page = await this.read(job);
      return await this.acceptPage(job, lease, page);
    } catch (error) {
      return this.fail(job, lease, error);
    }
  }

  /** Claims a job; a take-over of an expired lease is audited. */
  async claim(owner: string): Promise<JobLease | null> {
    const leaseSeconds = envInt('INTAKE_LEASE_SECONDS', 60);
    return this.dataSource.transaction(async (manager) => {
      const claimed = await claimDueJob(manager, owner, leaseSeconds);
      if (!claimed) return null;
      if (claimed.previousOwner)
        await this.auditReclaim(manager, claimed, owner);
      return {
        jobId: claimed.id,
        tenantId: claimed.tenantId,
        owner,
        leaseSeconds,
      };
    });
  }

  private async read(job: IngestionJob): Promise<ReadPage> {
    const connection = await this.connections.forTenant(
      job.tenantId,
      job.connectionId,
    );
    const adapter = this.adapters.get(connection.sourceType);
    return withTimeout(
      adapter.read({
        connection,
        scope: job.scope,
        cursor: job.committedCursor,
        pageSize: job.cadence.pageSize ?? 500,
        jobId: job.id,
      }),
      envInt('INTAKE_READ_TIMEOUT_MS', 120_000),
      `read job ${job.id}`,
    );
  }

  private async acceptPage(
    job: IngestionJob,
    lease: JobLease,
    page: ReadPage,
  ): Promise<PageOutcome> {
    const health: Record<string, number> = {};
    let lastObservationAt: Date | null = null;
    for (const [index, record] of page.records.entries()) {
      if (index > 0 && index % HEARTBEAT_EVERY === 0) {
        const held = await heartbeat(this.dataSource.manager, lease);
        if (!held) return { status: 'lease_lost', accepted: index };
      }
      const result = await this.intake.accept(
        { tenantId: job.tenantId, connectionId: job.connectionId },
        record,
      );
      health[result.status] = (health[result.status] ?? 0) + 1;
      lastObservationAt = latest(lastObservationAt, observedAtOf(record));
    }
    const state = await commitPage(this.dataSource.manager, lease, {
      cursor: page.nextCursor,
      hasMore: page.hasMore,
      intervalSeconds: job.cadence.intervalSeconds,
      health,
      lastObservationAt,
    });
    if (state === null)
      return { status: 'lease_lost', accepted: page.records.length };
    await this.afterCommit(job, page);
    if (state === 'stopped' && job.state === 'draining') {
      await this.auditRunner(lease, {
        action: 'drained',
        from: 'draining',
        to: 'stopped',
      });
    }
    return { status: 'committed', accepted: page.records.length, state };
  }

  /** Adapter bookkeeping after the commit; its failure never undoes the committed page. */
  private async afterCommit(job: IngestionJob, page: ReadPage): Promise<void> {
    try {
      await page.onCommitted?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Ingestion job ${job.id} post-commit hook: ${message}`);
    }
  }

  /**
   * Schedules the retry with backoff; an adapter error that cannot succeed on retry (lost credentials,
   * missing permission) fails the job at once and records its health code. The cursor never moves.
   */
  private async fail(
    job: IngestionJob,
    lease: JobLease,
    error: unknown,
  ): Promise<PageOutcome> {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 2000);
    this.logger.warn(`Ingestion job ${job.id} page failed: ${message}`);
    const classified = adapterErrorOf(error);
    const fatal = classified !== null && !classified.retryable;
    const state = await failPage(this.dataSource.manager, lease, {
      error: classified ? `${classified.code}: ${message}` : message,
      delaySeconds: backoffSeconds(job.retryCount, 5, 900),
      maxRetries: fatal ? 0 : envInt('INTAKE_MAX_RETRIES', 10),
      health: classified?.health ? { [classified.health]: 1 } : null,
    });
    if (state === 'failed') {
      await this.auditRunner(lease, {
        action: 'failed',
        from: job.state,
        to: 'failed',
      });
    }
    return { status: 'failed', error: message, state };
  }

  private auditReclaim(
    manager: DataSource['manager'],
    claimed: ClaimedJob,
    owner: string,
  ): Promise<void> {
    return recordTransition(manager, {
      tenantId: claimed.tenantId,
      jobId: claimed.id,
      action: 'lease_reclaimed',
      fromState: 'running',
      toState: 'running',
      actorId: null,
      runner: owner,
      detail: { previousOwner: claimed.previousOwner },
    });
  }

  private auditRunner(
    lease: JobLease,
    change: { action: string; from: string; to: string },
  ): Promise<void> {
    return recordTransition(this.dataSource.manager, {
      tenantId: lease.tenantId,
      jobId: lease.jobId,
      action: change.action,
      fromState: change.from,
      toState: change.to,
      actorId: null,
      runner: lease.owner,
      detail: null,
    });
  }
}

function observedAtOf(record: unknown): Date | null {
  if (typeof record !== 'object' || record === null) return null;
  const value = (record as { observedAt?: unknown }).observedAt;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function latest(current: Date | null, candidate: Date | null): Date | null {
  if (!candidate) return current;
  return !current || candidate > current ? candidate : current;
}
