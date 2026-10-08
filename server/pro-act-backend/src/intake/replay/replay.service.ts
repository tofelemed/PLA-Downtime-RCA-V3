import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { envInt } from '../../common/helpers/time-bounds';
import { runnerIdentity } from '../../common/scheduling/runner-identity';
import { IntegrationConnectionService } from '../connections/integration-connection.service';
import { IngestionException } from '../entities/ingestion-exception.entity';
import { ReplayRun, ReplayScopes } from '../entities/replay-run.entity';
import { ReplayExecutor } from './replay-executor';

export interface ReplayRequest {
  from?: Date;
  to?: Date;
  sourceObjectIds?: string[];
  exceptionIds?: string[];
  reason: string;
  dryRun?: boolean;
}

/**
 * Replay (spec ING05, plan 1.5): `request` records a `replay_runs` row (202 + job); the worker claims
 * queued runs (or runs whose lease expired) and the executor re-delivers the latest retained version of
 * every source object in scope with its original message id and the run id, then normalises it with the
 * current mappings. Replaying twice converges on the same canonical events (T06).
 */
@Injectable()
export class ReplayService {
  constructor(
    @InjectRepository(ReplayRun) private readonly runs: Repository<ReplayRun>,
    @InjectRepository(IngestionException)
    private readonly exceptions: Repository<IngestionException>,
    private readonly connections: IntegrationConnectionService,
    private readonly executor: ReplayExecutor,
  ) {}

  async request(
    context: RequestContext,
    connectionId: string,
    input: ReplayRequest,
  ): Promise<ReplayRun> {
    const connection = await this.connections.get(context, connectionId);
    if (input.from && input.to && input.from >= input.to) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RANGE',
        message: 'from must be before to',
      });
    }
    const scopes = await this.scopesOf(
      connection.tenantId,
      connection.id,
      input,
    );
    return this.runs.save(
      this.runs.create({
        tenantId: connection.tenantId,
        connectionId: connection.id,
        fromTime: input.from ?? null,
        toTime: input.to ?? null,
        scopes,
        reason: input.reason,
        dryRun: input.dryRun ?? false,
        state: 'queued',
        counts: {},
        requestedBy: context.userId,
        createdBy: context.userId,
        updatedBy: context.userId,
      }),
    );
  }

  /** Worker side: runs queued (or abandoned) replays until none is left. */
  async runPending(owner = runnerIdentity()): Promise<number> {
    let processed = 0;
    for (
      let run = await this.claim(owner);
      run;
      run = await this.claim(owner)
    ) {
      await this.executor.execute(run, owner);
      processed += 1;
    }
    return processed;
  }

  private async claim(owner: string): Promise<ReplayRun | null> {
    const [rows]: [Array<{ id: string }>, number] = await this.runs.query(
      `UPDATE "replay_runs" SET "state" = 'running', "lease_owner" = $1,
              "lease_expiry" = now() + make_interval(secs => $2), "updated_at" = now(),
              "row_version" = "row_version" + 1
        WHERE "id" = (SELECT "id" FROM "replay_runs"
                       WHERE "state" = 'queued' OR ("state" = 'running' AND "lease_expiry" < now())
                       ORDER BY "created_at" LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING "id"`,
      [owner, envInt('REPLAY_LEASE_SECONDS', 120)],
    );
    return rows[0] ? this.runs.findOneBy({ id: rows[0].id }) : null;
  }

  /** Exception ids are resolved to their source objects now; a foreign or unknown id is 422. */
  private async scopesOf(
    tenantId: string,
    connectionId: string,
    input: ReplayRequest,
  ): Promise<ReplayScopes> {
    const scopes: ReplayScopes = {};
    if (input.sourceObjectIds?.length)
      scopes.sourceObjectIds = input.sourceObjectIds;
    if (!input.exceptionIds?.length) return scopes;
    const found = await this.exceptions.find({
      where: { id: In(input.exceptionIds), tenantId, connectionId },
      select: { id: true, sourceObjectId: true },
    });
    if (found.length !== new Set(input.exceptionIds).size) {
      throw new UnprocessableEntityException({
        code: 'INVALID_REFERENCE',
        message:
          'exceptionIds must be exceptions of this connection and tenant',
      });
    }
    scopes.exceptionIds = found.map((row) => row.id);
    scopes.sourceObjectIds = [
      ...new Set([
        ...(scopes.sourceObjectIds ?? []),
        ...found.map((row) => row.sourceObjectId),
      ]),
    ];
    return scopes;
  }
}
