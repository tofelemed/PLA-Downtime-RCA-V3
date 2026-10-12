import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import {
  restrictedUnitIds,
  scopedQuery,
} from '../../common/query/scoped-query';
import { Unit } from '../../unit/unit.entity';
import { listResponse, ListResponse } from '../common/response';
import { MasterDataListQueryDto } from '../master-data/common/master-data-list-query.dto';
import { recordNotFound } from '../master-data/common/master-data-errors';
import { statusIncludes } from '../master-data/common/master-data-writer';
import { applySearch } from '../master-data/common/search';
import { sortedKeysetPage } from '../master-data/common/sorted-keyset-page';
import { toUnitView, UnitV2View } from './unit-v2.view';

/**
 * Units the caller may see (plan 3.2): the tenant's units, limited to the granted units for a unit-scoped
 * caller — the v1 `/units` route lists every tenant's units and is not used by v2 screens. The master-data
 * screens add a search on code / name, the active / retired filter and a code or name sort.
 */
@Injectable()
export class UnitsV2Service {
  constructor(
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
  ) {}

  async list(
    context: RequestContext,
    query: MasterDataListQueryDto,
  ): Promise<ListResponse<UnitV2View>> {
    const tenantId = requireTenantId(context);
    const qb = scopedQuery(this.units, 'u', { context, unitProperty: 'id' });
    const status = statusIncludes(query.status);
    if (!status.retired) qb.andWhere('u.retiredAt IS NULL');
    if (!status.active) qb.andWhere('u.retiredAt IS NOT NULL');
    applySearch(qb, 'u', query.q);
    const page = await sortedKeysetPage(qb, {
      alias: 'u',
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit,
    });
    const unitIds = restrictedUnitIds(context, tenantId);
    return listResponse(page.items.map(toUnitView), page.nextCursor, {
      tenantId,
      ...(unitIds ? { unitIds } : {}),
    });
  }

  async get(context: RequestContext, id: string): Promise<UnitV2View> {
    return toUnitView(await this.find(context, id));
  }

  /** The unit inside the caller's scope (404 otherwise), optionally inside a transaction. */
  async find(
    context: RequestContext,
    id: string,
    manager?: EntityManager,
  ): Promise<Unit> {
    const repository = manager ? manager.getRepository(Unit) : this.units;
    const unit = await scopedQuery(repository, 'u', {
      context,
      unitProperty: 'id',
    })
      .andWhere('u.id = :id', { id })
      .getOne();
    if (!unit) throw recordNotFound('unit');
    return unit;
  }
}
