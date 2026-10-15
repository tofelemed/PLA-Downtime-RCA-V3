import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { UnitImpactRule } from '../../plant-model/entities/unit-impact-rule.entity';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { UnitImpactRuleListQueryDto } from './unit-impact-rules-v2.dto';
import {
  toUnitImpactRuleView,
  UnitImpactRuleV2View,
} from './unit-impact-rules-v2.view';

/** v2 list of unit impact rule versions of the caller's units, keyset on (effectiveFrom, id). */
@Injectable()
export class UnitImpactRulesV2Service {
  constructor(
    @InjectRepository(UnitImpactRule)
    private readonly rules: Repository<UnitImpactRule>,
  ) {}

  async list(
    context: RequestContext,
    query: UnitImpactRuleListQueryDto,
  ): Promise<ListResponse<UnitImpactRuleV2View>> {
    const tenantId = requireTenantId(context);
    const qb = scopedQuery(this.rules, 'r', {
      context,
      unitProperty: 'unitId',
    });
    if (query.unitId) qb.andWhere('r.unitId = :unit', { unit: query.unitId });
    if (query.assetId)
      qb.andWhere('r.assetId = :asset', { asset: query.assetId });
    if (query.state) qb.andWhere('r.state = :state', { state: query.state });
    const page = await keysetPage(qb, {
      alias: 'r',
      property: 'effectiveFrom',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toUnitImpactRuleView), page.nextCursor, {
      tenantId,
    });
  }
}
