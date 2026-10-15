import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { LotDisposition } from '../../quality-dispositions/entities/lot-disposition.entity';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { LotDispositionListQueryDto } from './lot-disposition-v2.dto';
import {
  LotDispositionV2View,
  toLotDispositionView,
} from './lot-disposition-v2.view';

/** v2 list of lot dispositions (SME E3): unit-scoped, production-interval overlap, keyset on (productionStart, id). */
@Injectable()
export class LotDispositionsV2Service {
  constructor(
    @InjectRepository(LotDisposition)
    private readonly rows: Repository<LotDisposition>,
  ) {}

  async list(
    context: RequestContext,
    query: LotDispositionListQueryDto,
  ): Promise<ListResponse<LotDispositionV2View>> {
    const qb = scopedQuery(this.rows, 'd', { context, unitProperty: 'unitId' });
    const filters: Array<[keyof LotDispositionListQueryDto, string]> = [
      ['unitId', 'd.unitId = :unitId'],
      ['productId', 'd.productId = :productId'],
      ['lotCode', 'd.lotCode = :lotCode'],
      ['dispositionClass', 'd.dispositionClass = :dispositionClass'],
      ['state', 'd.state = :state'],
      ['from', 'd.productionEnd > :from'],
      ['to', 'd.productionStart < :to'],
    ];
    for (const [field, condition] of filters) {
      const value = query[field];
      if (value !== undefined) qb.andWhere(condition, { [field]: value });
    }
    const page = await keysetPage(qb, {
      alias: 'd',
      property: 'productionStart',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toLotDispositionView), page.nextCursor, {
      tenantId: requireTenantId(context),
    });
  }
}
