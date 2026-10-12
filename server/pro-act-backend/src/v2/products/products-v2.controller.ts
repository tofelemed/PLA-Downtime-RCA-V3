import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { MASTER_DATA_WRITERS } from '../master-data/common/master-data-writer';
import {
  ProductV2ChangeDto,
  ProductV2CreateDto,
  ProductV2ListQueryDto,
} from './product-v2.dto';
import { ProductV2View } from './product-v2.view';
import { ProductsV2CommandsService } from './products-v2-commands.service';
import { ProductsV2Service } from './products-v2.service';

/** Products for v2 screens: pickers (plan 3.4) and the master-data screens. */
@ApiTags('v2 · Products')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'products', version: '2' })
export class ProductsV2Controller {
  constructor(
    private readonly products: ProductsV2Service,
    private readonly commands: ProductsV2CommandsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List the products of the acting plant (keyset; sort createdAt, code or name)',
    description:
      'Tenant from the identity; products are master data, the same list for every member. ' +
      '`includeOrganization=true` adds the products shared by every plant of the organisation. ' +
      '`q` searches code and name; `status` = active | retired | all (default all).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: ProductV2ListQueryDto,
  ): Promise<ListResponse<ProductV2View>> {
    return this.products.list(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Get one product of the plant or its organisation (ETag = row version); others are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductV2View> {
    return this.products.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Create a product of the organisation (default) or of the acting plant',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant. 409 MASTER_DATA_CODE_EXISTS when a product of the ' +
      'plant, of the organisation or of another plant of the organisation has the code (case-insensitive).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: ProductV2CreateDto,
  ): Promise<ProductV2View> {
    return this.commands.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Change a product (an organisation product changes for every plant)',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 / 412 STALE_REVISION). 409 MASTER_DATA_CODE_EXISTS, 409 ' +
      'MASTER_DATA_RETIRED.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  change(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: ProductV2ChangeDto,
  ): Promise<ProductV2View> {
    return this.commands.change(ctx, { id, expectedVersion }, body);
  }

  @Post(':id/retire')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Retire a product (is_active = false; profiles and plans keep it)',
    description:
      'Requires `Idempotency-Key`. 409 MASTER_DATA_RETIRED when already retired.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductV2View> {
    return this.commands.retire(ctx, id);
  }

  @Post(':id/restore')
  @Idempotent()
  @HttpCode(200)
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Restore a retired product',
    description:
      'Requires `Idempotency-Key`. 409 MASTER_DATA_NOT_RETIRED for an active product.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  restore(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductV2View> {
    return this.commands.restore(ctx, id);
  }
}
