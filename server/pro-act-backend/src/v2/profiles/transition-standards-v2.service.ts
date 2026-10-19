import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { GradeTransitionStandard } from '../../profiles/entities/transition-standard.entity';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { TransitionStandardListQueryDto } from './transition-standard-v2.dto';
import {
  toTransitionStandardView,
  TransitionStandardV2View,
} from './transition-standard-v2.view';

/** v2 list of the grade-transition matrix (LA-08): unit-scoped, keyset on (effectiveFrom, id). */
@Injectable()
export class TransitionStandardsV2Service {
  constructor(
    @InjectRepository(GradeTransitionStandard)
    private readonly standards: Repository<GradeTransitionStandard>,
  ) {}

  async list(
    context: RequestContext,
    query: TransitionStandardListQueryDto,
  ): Promise<ListResponse<TransitionStandardV2View>> {
    const qb = scopedQuery(this.standards, 's', {
      context,
      unitProperty: 'unitId',
    });
    if (query.unitId)
      qb.andWhere('s.unitId = :unitId', { unitId: query.unitId });
    if (query.fromProductId)
      qb.andWhere('s.fromProductId = :from', { from: query.fromProductId });
    if (query.toProductId)
      qb.andWhere('s.toProductId = :to', { to: query.toProductId });
    if (query.state) qb.andWhere('s.state = :state', { state: query.state });
    const page = await keysetPage(qb, {
      alias: 's',
      property: 'effectiveFrom',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
      focus: query.focus,
    });
    return listResponse(
      page.items.map(toTransitionStandardView),
      page.nextCursor,
      {
        tenantId: requireTenantId(context),
      },
    );
  }
}
