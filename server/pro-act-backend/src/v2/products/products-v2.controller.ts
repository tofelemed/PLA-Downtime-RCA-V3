import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { ListQueryDto } from '../common/list-query.dto';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { ProductV2View } from './product-v2.view';
import { ProductsV2Service } from './products-v2.service';

/** Product reads for v2 screens (plan 3.4: profile and plan product pickers). */
@ApiTags('v2 · Products')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'products', version: '2' })
export class ProductsV2Controller {
  constructor(private readonly products: ProductsV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'List the products of the caller tenant (keyset on createdAt, id)',
    description:
      'Tenant from the identity; products are tenant master data, the same list for every member.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: ListQueryDto,
  ): Promise<ListResponse<ProductV2View>> {
    return this.products.list(ctx, query);
  }
}
