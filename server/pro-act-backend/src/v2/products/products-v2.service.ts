import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { Product } from '../../product/product.entity';
import { listResponse, ListResponse } from '../common/response';
import { recordNotFound } from '../master-data/common/master-data-errors';
import {
  organizationOfTenant,
  statusIncludes,
} from '../master-data/common/master-data-writer';
import { applySearch } from '../master-data/common/search';
import { sortedKeysetPage } from '../master-data/common/sorted-keyset-page';
import { ProductV2ListQueryDto } from './product-v2.dto';
import { ProductV2View, toProductView } from './product-v2.view';

/**
 * Products the caller may use. Products are master data, not unit-scoped. By default only the acting
 * plant's products (what profiles and plans accept, plan 3.4); with `includeOrganization` also the
 * products of the plant's organisation that name no plant (the v1 model of the Master Data screen) —
 * the one v2 read that is not a plain `scopedQuery`, because those rows have no tenant (DECISIONS
 * 2026-10-12 "Master data on v2").
 */
@Injectable()
export class ProductsV2Service {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async list(
    context: RequestContext,
    query: ProductV2ListQueryDto,
  ): Promise<ListResponse<ProductV2View>> {
    const tenantId = requireTenantId(context);
    const qb = query.includeOrganization
      ? await this.visibleQuery(context, this.products.manager)
      : scopedQuery(this.products, 'p', { context });
    const status = statusIncludes(query.status);
    if (!status.retired) qb.andWhere('p.isActive = true');
    if (!status.active) qb.andWhere('p.isActive = false');
    applySearch(qb, 'p', query.q);
    const page = await sortedKeysetPage(qb, {
      alias: 'p',
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(
      page.items.map((row) => toProductView(row)),
      page.nextCursor,
      {
        tenantId,
      },
    );
  }

  async get(context: RequestContext, id: string): Promise<ProductV2View> {
    return toProductView(await this.find(context, id), true);
  }

  /** A product of the plant or of its organisation (404 otherwise). */
  async find(
    context: RequestContext,
    id: string,
    manager: EntityManager = this.products.manager,
  ): Promise<Product> {
    const qb = await this.visibleQuery(context, manager);
    const product = await qb.andWhere('p.id = :id', { id }).getOne();
    if (!product) throw recordNotFound('product');
    return product;
  }

  /** Products of the acting plant plus the organisation's products that name no plant. */
  private async visibleQuery(
    context: RequestContext,
    manager: EntityManager,
  ): Promise<SelectQueryBuilder<Product>> {
    const tenantId = requireTenantId(context);
    const organizationId = await organizationOfTenant(manager, tenantId);
    return manager
      .getRepository(Product)
      .createQueryBuilder('p')
      .where(
        new Brackets((where) =>
          where
            .where('p.tenantId = :scopeTenantId', { scopeTenantId: tenantId })
            .orWhere(
              '(p.tenantId IS NULL AND p.organizationId = :scopeOrganizationId)',
              {
                scopeOrganizationId: organizationId,
              },
            ),
        ),
      );
  }
}
