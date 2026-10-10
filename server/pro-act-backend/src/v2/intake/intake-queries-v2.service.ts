import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { IngestionException } from '../../intake/entities/ingestion-exception.entity';
import { IngestionJobTransition } from '../../intake/entities/ingestion-job-transition.entity';
import { IngestionJob } from '../../intake/entities/ingestion-job.entity';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { RawObservation } from '../../intake/entities/raw-observation.entity';
import { ReplayRun } from '../../intake/entities/replay-run.entity';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { parseSort } from '../common/sort-spec';
import { ConnectionListQueryDto } from './connection-v2.dto';
import { IngestionExceptionListQueryDto } from './ingestion-exception-v2.dto';
import { IngestionJobListQueryDto } from './ingestion-job-v2.dto';
import { REPLAY_ROLES } from './intake-roles';
import {
  ConnectionV2View,
  IngestionExceptionDetailV2View,
  IngestionExceptionV2View,
  IngestionJobV2View,
  JobTransitionV2View,
  ReplayRunV2View,
  toConnectionView,
  toExceptionDetailView,
  toExceptionView,
  toJobView,
  toReplayRunView,
  toTransitionView,
} from './intake-v2.view';

const TRANSITIONS_CAP = 500;

/** Tenant-scoped reads of the intake resources (plan 1.5 step 8): keyset lists and details. */
@Injectable()
export class IntakeQueriesV2Service {
  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connections: Repository<IntegrationConnection>,
    @InjectRepository(IngestionJob)
    private readonly jobs: Repository<IngestionJob>,
    @InjectRepository(IngestionJobTransition)
    private readonly transitions: Repository<IngestionJobTransition>,
    @InjectRepository(IngestionException)
    private readonly exceptions: Repository<IngestionException>,
    @InjectRepository(ReplayRun) private readonly runs: Repository<ReplayRun>,
  ) {}

  async listConnections(
    context: RequestContext,
    query: ConnectionListQueryDto,
  ): Promise<ListResponse<ConnectionV2View>> {
    const qb = scopedQuery(this.connections, 'c', { context });
    if (query.sourceType)
      qb.andWhere('c.sourceType = :type', { type: query.sourceType });
    if (!query.includeInactive) qb.andWhere('c.isActive = true');
    const page = await keysetPage(qb, {
      alias: 'c',
      property: 'createdAt',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toConnectionView), page.nextCursor, {
      tenantId: requireTenantId(context),
    });
  }

  async listJobs(
    context: RequestContext,
    query: IngestionJobListQueryDto,
  ): Promise<ListResponse<IngestionJobV2View>> {
    const qb = scopedQuery(this.jobs, 'j', { context });
    if (query.connectionId) {
      qb.andWhere('j.connectionId = :connectionId', {
        connectionId: query.connectionId,
      });
    }
    if (query.state) qb.andWhere('j.state = :state', { state: query.state });
    const page = await keysetPage(qb, {
      alias: 'j',
      property: 'createdAt',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toJobView), page.nextCursor, {
      tenantId: requireTenantId(context),
    });
  }

  /** Audit trail of a job, oldest first, capped at 500 rows (a job changes state rarely). */
  async jobTransitions(
    context: RequestContext,
    jobId: string,
  ): Promise<JobTransitionV2View[]> {
    const rows = await scopedQuery(this.transitions, 't', { context })
      .andWhere('t.jobId = :jobId', { jobId })
      .orderBy('t.createdAt', 'ASC')
      .addOrderBy('t.id', 'ASC')
      .take(TRANSITIONS_CAP)
      .getMany();
    return rows.map(toTransitionView);
  }

  async listExceptions(
    context: RequestContext,
    query: IngestionExceptionListQueryDto,
  ): Promise<ListResponse<IngestionExceptionV2View>> {
    const sort = parseSort(query.sort, ['lastSeen', 'firstSeen'] as const, {
      field: 'lastSeen',
      direction: 'DESC',
    });
    const qb = scopedQuery(this.exceptions, 'ex', { context });
    if (query.state) qb.andWhere('ex.state = :state', { state: query.state });
    if (query.errorCode)
      qb.andWhere('ex.errorCode = :code', { code: query.errorCode });
    if (query.connectionId) {
      qb.andWhere('ex.connectionId = :connectionId', {
        connectionId: query.connectionId,
      });
    }
    if (query.sourceObjectId) {
      qb.andWhere('ex.sourceObjectId = :objectId', {
        objectId: query.sourceObjectId,
      });
    }
    const page = await keysetPage(qb, {
      alias: 'ex',
      property: sort.field,
      direction: sort.direction,
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toExceptionView), page.nextCursor, {
      tenantId: requireTenantId(context),
    });
  }

  /** One exception with the raw delivery it points at; 404 for foreign or unknown ids. */
  async exception(
    context: RequestContext,
    id: string,
  ): Promise<IngestionExceptionDetailV2View> {
    const row = await scopedQuery(this.exceptions, 'ex', { context })
      .andWhere('ex.id = :id', { id })
      .getOne();
    if (!row) throw notFound('Ingestion exception');
    const raw = await this.exceptions.manager.findOne(RawObservation, {
      where: {
        id: row.rawId,
        receivedAt: row.rawReceivedAt,
        tenantId: row.tenantId,
      },
    });
    return toExceptionDetailView(row, raw, mayReadRawPayload(context));
  }

  async replayRun(
    context: RequestContext,
    id: string,
  ): Promise<ReplayRunV2View> {
    const run = await scopedQuery(this.runs, 'r', { context })
      .andWhere('r.id = :id', { id })
      .getOne();
    if (!run) throw notFound('Replay run');
    return toReplayRunView(run);
  }
}

/** Raw source payloads are for the roles that may resolve the quarantine (plan 3.7). */
function mayReadRawPayload(context: RequestContext): boolean {
  return (
    context.isSuperAdmin ||
    REPLAY_ROLES.some((role) => context.roles.includes(role))
  );
}

function notFound(what: string): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: `${what} not found`,
  });
}
