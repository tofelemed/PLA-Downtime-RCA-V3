import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Asset } from '../../asset/asset.entity';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import {
  restrictedUnitIds,
  scopedQuery,
} from '../../common/query/scoped-query';
import { listResponse, ListResponse } from '../common/response';
import { recordNotFound } from '../master-data/common/master-data-errors';
import { statusIncludes } from '../master-data/common/master-data-writer';
import { applySearch } from '../master-data/common/search';
import { sortedKeysetPage } from '../master-data/common/sorted-keyset-page';
import { AssetV2ListQueryDto } from './asset-v2.dto';
import { AssetV2View, toAssetView } from './asset-v2.view';

/**
 * Assets of the acting plant (master data): unit-scoped callers see the assets of their units only.
 * Filters: units, code / name search, active / retired; sort by code, name or creation time.
 */
@Injectable()
export class AssetsV2Service {
  constructor(
    @InjectRepository(Asset) private readonly assets: Repository<Asset>,
  ) {}

  async list(
    context: RequestContext,
    query: AssetV2ListQueryDto,
  ): Promise<ListResponse<AssetV2View>> {
    const tenantId = requireTenantId(context);
    const qb = scopedQuery(this.assets, 'a', {
      context,
      unitProperty: 'unitId',
    });
    if (query.unitIds?.length) {
      qb.andWhere('a.unitId IN (:...filterUnitIds)', {
        filterUnitIds: query.unitIds,
      });
    }
    const status = statusIncludes(query.status);
    if (!status.retired) qb.andWhere('a.retiredAt IS NULL');
    if (!status.active) qb.andWhere('a.retiredAt IS NOT NULL');
    applySearch(qb, 'a', query.q);
    const page = await sortedKeysetPage(qb, {
      alias: 'a',
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit,
    });
    const unitIds = restrictedUnitIds(context, tenantId);
    return listResponse(page.items.map(toAssetView), page.nextCursor, {
      tenantId,
      ...(unitIds ? { unitIds } : {}),
    });
  }

  async get(context: RequestContext, id: string): Promise<AssetV2View> {
    return toAssetView(await this.find(context, id));
  }

  /** The asset inside the caller's scope (404 otherwise), optionally inside a transaction. */
  async find(
    context: RequestContext,
    id: string,
    manager?: EntityManager,
  ): Promise<Asset> {
    const repository = manager ? manager.getRepository(Asset) : this.assets;
    const asset = await scopedQuery(repository, 'a', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('a.id = :id', { id })
      .getOne();
    if (!asset) throw recordNotFound('asset');
    return asset;
  }
}
