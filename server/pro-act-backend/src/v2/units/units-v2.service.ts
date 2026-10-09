import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import {
  restrictedUnitIds,
  scopedQuery,
} from '../../common/query/scoped-query';
import { Unit } from '../../unit/unit.entity';
import { ListQueryDto } from '../common/list-query.dto';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { toUnitView, UnitV2View } from './unit-v2.view';

/**
 * Units the caller may see (plan 3.2): the tenant's units, limited to the granted units for a
 * unit-scoped caller — the v1 `/units` route lists every tenant's units and is not used by v2 screens.
 */
@Injectable()
export class UnitsV2Service {
  constructor(
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
  ) {}

  async list(
    context: RequestContext,
    query: ListQueryDto,
  ): Promise<ListResponse<UnitV2View>> {
    const tenantId = requireTenantId(context);
    const qb = scopedQuery(this.units, 'u', { context, unitProperty: 'id' });
    const page = await keysetPage(qb, {
      alias: 'u',
      property: 'createdAt',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const unitIds = restrictedUnitIds(context, tenantId);
    return listResponse(page.items.map(toUnitView), page.nextCursor, {
      tenantId,
      ...(unitIds ? { unitIds } : {}),
    });
  }
}
