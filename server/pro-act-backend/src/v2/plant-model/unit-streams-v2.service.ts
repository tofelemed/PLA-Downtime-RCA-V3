import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { StreamRunRecord } from '../../plant-model/entities/stream-run.entity';
import { UnitStream } from '../../plant-model/entities/unit-stream.entity';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import {
  StreamRunListQueryDto,
  UnitStreamListQueryDto,
} from './unit-stream-v2.dto';
import {
  StreamRunV2View,
  toStreamRunView,
  toUnitStreamView,
  UnitStreamV2View,
} from './unit-stream-v2.view';

/** v2 lists of unit streams and stream runs (SME E6): unit-scoped, keyset pages. */
@Injectable()
export class UnitStreamsV2Service {
  constructor(
    @InjectRepository(UnitStream)
    private readonly streams: Repository<UnitStream>,
    @InjectRepository(StreamRunRecord)
    private readonly runs: Repository<StreamRunRecord>,
  ) {}

  async listStreams(
    context: RequestContext,
    query: UnitStreamListQueryDto,
  ): Promise<ListResponse<UnitStreamV2View>> {
    const qb = scopedQuery(this.streams, 's', {
      context,
      unitProperty: 'unitId',
    });
    if (query.unitId)
      qb.andWhere('s.unitId = :unitId', { unitId: query.unitId });
    if (query.state) qb.andWhere('s.state = :state', { state: query.state });
    const page = await keysetPage(qb, {
      alias: 's',
      property: 'effectiveFrom',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
      focus: query.focus,
    });
    return listResponse(page.items.map(toUnitStreamView), page.nextCursor, {
      tenantId: requireTenantId(context),
    });
  }

  /** Runs overlapping [from, to) when given, newest first. */
  async listRuns(
    context: RequestContext,
    query: StreamRunListQueryDto,
  ): Promise<ListResponse<StreamRunV2View>> {
    const qb = scopedQuery(this.runs, 'r', {
      context,
      unitProperty: 'unitId',
    });
    if (query.unitId)
      qb.andWhere('r.unitId = :unitId', { unitId: query.unitId });
    if (query.streamCode)
      qb.andWhere('r.streamCode = :code', { code: query.streamCode });
    if (query.to) qb.andWhere('r.startTime < :to', { to: query.to });
    if (query.from)
      qb.andWhere('(r.endTime IS NULL OR r.endTime > :from)', {
        from: query.from,
      });
    const page = await keysetPage(qb, {
      alias: 'r',
      property: 'startTime',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toStreamRunView), page.nextCursor, {
      tenantId: requireTenantId(context),
    });
  }
}
