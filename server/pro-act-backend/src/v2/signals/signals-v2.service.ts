import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { Signal } from '../../signals/entities/signal.entity';
import { SignalBackfillService } from '../../signals/signal-backfill.service';
import { SignalPreviewService } from '../../signals/signal-preview.service';
import { SignalsService } from '../../signals/signals.service';
import { keysetPage } from '../common/keyset-page';
import { JobAccepted, listResponse, ListResponse } from '../common/response';
import {
  SignalListQueryDto,
  SignalV2WriteDto,
  SignalWindowDto,
} from './signal-v2.dto';
import {
  SignalBackfillV2View,
  SignalPreviewV2View,
  SignalV2View,
  toBackfillView,
  toPreviewView,
  toSignalView,
} from './signal-v2.view';

/** v2 signals (plan 1.7 step 6): tenant-scoped list/get/create, quantity preview and backfill runs. */
@Injectable()
export class SignalsV2Service {
  constructor(
    @InjectRepository(Signal) private readonly signals: Repository<Signal>,
    private readonly definitions: SignalsService,
    private readonly previews: SignalPreviewService,
    private readonly backfills: SignalBackfillService,
  ) {}

  async list(
    context: RequestContext,
    query: SignalListQueryDto,
  ): Promise<ListResponse<SignalV2View>> {
    const qb = scopedQuery(this.signals, 's', {
      context,
      unitProperty: 'unitId',
    });
    if (query.unitId)
      qb.andWhere('s.unitId = :unitId', { unitId: query.unitId });
    if (query.connectionId) {
      qb.andWhere('s.connectionId = :connectionId', {
        connectionId: query.connectionId,
      });
    }
    if (query.semanticType) {
      qb.andWhere('s.semanticType = :semanticType', {
        semanticType: query.semanticType,
      });
    }
    const page = await keysetPage(qb, {
      alias: 's',
      property: 'createdAt',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toSignalView), page.nextCursor, {
      tenantId: requireTenantId(context),
    });
  }

  async get(context: RequestContext, id: string): Promise<SignalV2View> {
    return toSignalView(await this.definitions.get(context, id));
  }

  async create(
    context: RequestContext,
    body: SignalV2WriteDto,
  ): Promise<SignalV2View> {
    return toSignalView(await this.definitions.create(context, body));
  }

  async preview(
    context: RequestContext,
    id: string,
    body: SignalWindowDto,
  ): Promise<SignalPreviewV2View> {
    const signal = await this.definitions.get(context, id);
    const preview = await this.previews.preview(signal, windowOf(body));
    return toPreviewView(signal, preview);
  }

  async backfill(
    context: RequestContext,
    id: string,
    body: SignalWindowDto,
  ): Promise<JobAccepted> {
    const signal = await this.definitions.get(context, id);
    const run = await this.backfills.request(context, signal, windowOf(body));
    return {
      jobId: run.id,
      statusUrl: `/api/v2/signals/${signal.id}/backfills/${run.id}`,
    };
  }

  async getBackfill(
    context: RequestContext,
    id: string,
    runId: string,
  ): Promise<SignalBackfillV2View> {
    const run = await this.backfills.get(requireTenantId(context), id, runId);
    if (!run) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Backfill run not found',
      });
    }
    return toBackfillView(run);
  }
}

function windowOf(body: SignalWindowDto): { from: Date; to: Date } {
  return { from: new Date(body.from), to: new Date(body.to) };
}
