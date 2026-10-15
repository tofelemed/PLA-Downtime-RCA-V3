import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { UncertaintyBudget } from '../../uncertainty/entities/uncertainty-budget.entity';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { UncertaintyBudgetListQueryDto } from './uncertainty-budget-v2.dto';
import {
  toUncertaintyBudgetView,
  UncertaintyBudgetV2View,
} from './uncertainty-budget-v2.view';

/** v2 list of uncertainty budgets (SME E4): unit-scoped, effective-interval overlap, keyset on (effectiveFrom, id). */
@Injectable()
export class UncertaintyBudgetsV2Service {
  constructor(
    @InjectRepository(UncertaintyBudget)
    private readonly rows: Repository<UncertaintyBudget>,
  ) {}

  async list(
    context: RequestContext,
    query: UncertaintyBudgetListQueryDto,
  ): Promise<ListResponse<UncertaintyBudgetV2View>> {
    const qb = scopedQuery(this.rows, 'b', { context, unitProperty: 'unitId' });
    const filters: Array<[keyof UncertaintyBudgetListQueryDto, string]> = [
      ['unitId', 'b.unitId = :unitId'],
      ['boundary', 'b.boundary = :boundary'],
      ['state', 'b.state = :state'],
      ['from', '(b.effectiveTo IS NULL OR b.effectiveTo > :from)'],
      ['to', 'b.effectiveFrom < :to'],
    ];
    for (const [field, condition] of filters) {
      const value = query[field];
      if (value !== undefined) qb.andWhere(condition, { [field]: value });
    }
    const page = await keysetPage(qb, {
      alias: 'b',
      property: 'effectiveFrom',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const now = new Date();
    return listResponse(
      page.items.map((row) => toUncertaintyBudgetView(row, now)),
      page.nextCursor,
      { tenantId: requireTenantId(context) },
    );
  }
}
