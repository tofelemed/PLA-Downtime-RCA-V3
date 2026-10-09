import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { Product } from '../../product/product.entity';
import { keysetPage } from '../common/keyset-page';
import { ListQueryDto } from '../common/list-query.dto';
import { listResponse, ListResponse } from '../common/response';
import { ProductV2View, toProductView } from './product-v2.view';

/**
 * Products of the caller's tenant (plan 3.4: profile and plan pickers). Products are tenant master data
 * (not unit-scoped), so every member of the tenant sees the same list; the v1 `/products` route is not
 * used by v2 screens.
 */
@Injectable()
export class ProductsV2Service {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async list(
    context: RequestContext,
    query: ListQueryDto,
  ): Promise<ListResponse<ProductV2View>> {
    const tenantId = requireTenantId(context);
    const page = await keysetPage(
      scopedQuery(this.products, 'p', { context }),
      {
        alias: 'p',
        property: 'createdAt',
        direction: 'ASC',
        cursor: query.cursor,
        limit: query.limit,
      },
    );
    return listResponse(page.items.map(toProductView), page.nextCursor, {
      tenantId,
    });
  }
}
