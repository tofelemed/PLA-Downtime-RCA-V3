import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { envInt } from '../../common/helpers/time-bounds';
import { CanonicalEnvelope } from '../envelope/canonical-envelope';
import { ReplayCounts, ReplayRun } from '../entities/replay-run.entity';
import { SourceObject } from '../entities/source-object.entity';
import { IntakeService } from '../intake.service';
import { NormalizationService } from '../normalization/normalization.service';
import { findRaw } from '../raw-store';

type CountKey = Exclude<keyof ReplayCounts, 'objects'>;

const EMPTY_COUNTS: ReplayCounts = {
  objects: 0,
  normalized: 0,
  quarantined: 0,
  unchanged: 0,
  failed: 0,
};

/**
 * Executes one claimed replay run: pages through the source objects in scope (keyset on the source
 * object id, 200 per page), re-delivers each latest retained version through intake with the run id
 * (raw lineage: a new raw row pointing at the original) and normalises it inline. Progress and the
 * lease are checkpointed per page, so a reclaimed run continues after the last finished page.
 */
@Injectable()
export class ReplayExecutor {
  private readonly logger = new Logger(ReplayExecutor.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly intake: IntakeService,
    private readonly normalization: NormalizationService,
  ) {}

  async execute(run: ReplayRun, owner: string): Promise<void> {
    const counts: ReplayCounts = { ...EMPTY_COUNTS, ...run.counts };
    let cursor = run.cursor;
    try {
      for (
        let page = await this.page(run, cursor);
        page.length > 0;
        page = await this.page(run, cursor)
      ) {
        for (const object of page) {
          counts.objects += 1;
          if (!run.dryRun) counts[await this.replayObject(run, object)] += 1;
        }
        cursor = page[page.length - 1].sourceObjectId;
        if (!(await this.checkpoint(run, owner, { cursor, counts }))) return;
      }
      await this.finish(run, owner, {
        state: 'completed',
        counts,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Replay run ${run.id} failed: ${message}`);
      await this.finish(run, owner, {
        state: 'failed',
        counts,
        error: message.slice(0, 2000),
      });
    }
  }

  private page(run: ReplayRun, cursor: string | null): Promise<SourceObject[]> {
    const qb = this.dataSource.manager
      .createQueryBuilder(SourceObject, 'so')
      .where('so.tenantId = :tenantId AND so.connectionId = :connectionId', {
        tenantId: run.tenantId,
        connectionId: run.connectionId,
      });
    const ids = run.scopes.sourceObjectIds;
    if (ids?.length) qb.andWhere('so.sourceObjectId IN (:...ids)', { ids });
    // a period replay leaves records an operator closed as irrecoverable alone ("never replayed");
    // naming the object or its exception explicitly still replays it
    if (!ids?.length && !run.scopes.exceptionIds?.length) {
      qb.andWhere(
        `NOT EXISTS (SELECT 1 FROM "ingestion_exceptions" "ie"
           WHERE "ie"."tenant_id" = "so"."tenant_id" AND "ie"."connection_id" = "so"."connection_id"
             AND "ie"."source_object_id" = "so"."source_object_id" AND "ie"."state" = 'irrecoverable')`,
      );
    }
    if (run.fromTime)
      qb.andWhere('so.latestObservedAt >= :from', { from: run.fromTime });
    if (run.toTime)
      qb.andWhere('so.latestObservedAt < :to', { to: run.toTime });
    if (cursor) qb.andWhere('so.sourceObjectId > :cursor', { cursor });
    return qb
      .orderBy('so.sourceObjectId', 'ASC')
      .take(envInt('REPLAY_PAGE_SIZE', 200))
      .getMany();
  }

  private async replayObject(
    run: ReplayRun,
    object: SourceObject,
  ): Promise<CountKey> {
    try {
      const raw = await findRaw(this.dataSource.manager, {
        rawId: object.latestRawId,
        receivedAt: object.latestReceivedAt,
      });
      if (!raw?.payload || !raw.kind) return 'failed';
      const original = raw.payload as unknown as CanonicalEnvelope;
      const accepted = await this.intake.accept(
        { tenantId: run.tenantId, connectionId: run.connectionId },
        {
          ...original,
          provenance: { ...original.provenance, replayRunId: run.id },
        },
      );
      if (!accepted.ticket) return 'unchanged';
      const outcome = await this.normalization.normalize(accepted.ticket);
      if (outcome.status === 'duplicate') return 'unchanged';
      if (outcome.result.status === 'quarantined') return 'quarantined';
      return ['unchanged', 'superseded'].includes(outcome.result.outcome)
        ? 'unchanged'
        : 'normalized';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Replay ${run.id}: ${object.sourceObjectId} failed: ${message}`,
      );
      return 'failed';
    }
  }

  /** Saves progress and extends the lease; false when another worker took the run over. */
  private async checkpoint(
    run: ReplayRun,
    owner: string,
    progress: { cursor: string; counts: ReplayCounts },
  ): Promise<boolean> {
    const [rows]: [unknown[], number] = await this.dataSource.query(
      `UPDATE "replay_runs" SET "cursor" = $3, "counts" = $4::jsonb,
              "lease_expiry" = now() + make_interval(secs => $5), "updated_at" = now()
        WHERE "id" = $1 AND "lease_owner" = $2 RETURNING "id"`,
      [
        run.id,
        owner,
        progress.cursor,
        JSON.stringify(progress.counts),
        envInt('REPLAY_LEASE_SECONDS', 120),
      ],
    );
    return rows.length > 0;
  }

  private async finish(
    run: ReplayRun,
    owner: string,
    end: {
      state: 'completed' | 'failed';
      counts: ReplayCounts;
      error: string | null;
    },
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE "replay_runs" SET "state" = $3::replay_run_state, "counts" = $4::jsonb, "last_error" = $5,
              "finished_at" = now(), "lease_owner" = NULL, "lease_expiry" = NULL, "updated_at" = now(),
              "row_version" = "row_version" + 1
        WHERE "id" = $1 AND "lease_owner" = $2`,
      [run.id, owner, end.state, JSON.stringify(end.counts), end.error],
    );
  }
}
