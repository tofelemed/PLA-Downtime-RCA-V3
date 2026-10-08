import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { IngestionJobsService } from '../intake/jobs/ingestion-jobs.service';
import {
  BackfillState,
  SignalBackfillRun,
} from './entities/signal-backfill-run.entity';
import { Signal } from './entities/signal.entity';

/** Backfill depth (D02 item 8 default: 90 days). */
const MAX_BACKFILL_DAYS = 90;
const DAY_MS = 86_400_000;

/** The `backfill` job scope a run executes as (read by the PI signal reader). */
export interface BackfillScope {
  mode: 'backfill';
  signalIds: string[];
  from: string;
  to: string;
  runId: string;
  [key: string]: unknown;
}

/**
 * Bounded historical re-reads of one signal (PI08, `POST /signals/{id}/backfill`): a run row plus a
 * leased ingestion job in mode `backfill` that drains — it reads `[from, to)` page by page through
 * intake and stops when caught up. Marker-loss backfills of the stream-updates job are recorded here
 * too (`recordCompleted`).
 */
@Injectable()
export class SignalBackfillService {
  constructor(
    @InjectRepository(SignalBackfillRun)
    private readonly runs: Repository<SignalBackfillRun>,
    private readonly jobs: IngestionJobsService,
  ) {}

  async request(
    context: RequestContext,
    signal: Signal,
    window: { from: Date; to: Date },
  ): Promise<SignalBackfillRun> {
    assertBackfillWindow(window);
    const run = await this.runs.save(
      this.runs.create({
        tenantId: signal.tenantId,
        signalId: signal.id,
        fromTime: window.from,
        toTime: window.to,
        state: 'queued',
        reason: 'requested',
        createdBy: context.userId,
        updatedBy: context.userId,
      }),
    );
    try {
      run.ingestionJobId = await this.startJob(context, signal, run);
    } catch (error) {
      await this.runs.update(run.id, { state: 'failed' });
      throw error;
    }
    return this.runs.save(run);
  }

  /** The draining `backfill` job that executes the run. */
  private async startJob(
    context: RequestContext,
    signal: Signal,
    run: SignalBackfillRun,
  ): Promise<string> {
    const scope: BackfillScope = {
      mode: 'backfill',
      signalIds: [signal.id],
      from: run.fromTime.toISOString(),
      to: run.toTime.toISOString(),
      runId: run.id,
    };
    const job = await this.jobs.create(context, signal.connectionId, {
      scope,
      start: true,
    });
    await this.jobs.command(context, job.id, 'drain', `backfill run ${run.id}`);
    return job.id;
  }

  get(
    tenantId: string,
    signalId: string,
    runId: string,
  ): Promise<SignalBackfillRun | null> {
    return this.runs.findOneBy({ id: runId, tenantId, signalId });
  }

  /** Moves a run forward (`running` on the first page, `completed` after the last); never backwards. */
  async advance(runId: string, state: BackfillState): Promise<void> {
    const from = state === 'running' ? ['queued'] : ['queued', 'running'];
    await this.runs
      .createQueryBuilder()
      .update()
      .set({ state, updatedAt: () => 'now()' })
      .where('id = :runId AND state IN (:...from)', { runId, from })
      .execute();
  }

  /** A backfill the stream-updates job already ran (marker loss), recorded as completed. */
  async recordCompleted(run: {
    tenantId: string;
    signalId: string;
    from: Date;
    to: Date;
    detail: Record<string, unknown>;
  }): Promise<void> {
    await this.runs.save(
      this.runs.create({
        tenantId: run.tenantId,
        signalId: run.signalId,
        fromTime: run.from,
        toTime: run.to,
        state: 'completed',
        reason: 'marker_lost',
        detail: run.detail,
      }),
    );
  }
}

function assertBackfillWindow(window: { from: Date; to: Date }): void {
  const span = window.to.getTime() - window.from.getTime();
  if (!(span > 0)) {
    throw new UnprocessableEntityException({
      code: 'INVALID_RANGE',
      message: 'from must be before to',
    });
  }
  if (span > MAX_BACKFILL_DAYS * DAY_MS || window.to.getTime() > Date.now()) {
    throw new UnprocessableEntityException({
      code: 'INVALID_BACKFILL_WINDOW',
      message: `A backfill covers at most ${MAX_BACKFILL_DAYS} days and ends no later than now`,
    });
  }
}
