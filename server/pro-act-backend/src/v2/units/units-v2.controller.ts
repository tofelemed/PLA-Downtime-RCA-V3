import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { ListQueryDto } from '../common/list-query.dto';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { UnitV2View } from './unit-v2.view';
import { UnitsV2Service } from './units-v2.service';

/** Unit reads for v2 screens (plan 3.2: Event Hub unit filter and create form). */
@ApiTags('v2 · Units')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'units', version: '2' })
export class UnitsV2Controller {
  constructor(private readonly units: UnitsV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'List the units of the caller scope (keyset on createdAt, id)',
    description:
      'Tenant from the identity; a caller with unit-level grants sees only those units (`scope.unitIds`).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: ListQueryDto,
  ): Promise<ListResponse<UnitV2View>> {
    return this.units.list(ctx, query);
  }
}
