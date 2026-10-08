import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  resolveRequestTenantId,
  TENANT_SELECTION_HEADER,
} from '../../auth/request-tenant';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { ProductionEventListQueryDto } from './production-event-list-query.dto';
import { ProductionEventV2View } from './production-event-v2.view';
import { ProductionEventsV2Service } from './production-events-v2.service';

@ApiTags('v2 · Production Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantQueryParamGuard)
@Controller({ path: 'production-events', version: '2' })
export class ProductionEventsV2Controller {
  constructor(private readonly service: ProductionEventsV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'List production events of the caller tenant',
    description:
      'Filters AND across parameters and OR within a repeated parameter; from/to is a half-open window with ' +
      'overlap semantics; pages are keyset-based on (startTime, id). The tenant comes from the token.',
  })
  @ApiHeader({
    name: 'X-Tenant-Id',
    required: false,
    description: 'SuperAdmin only: tenant to act on',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Headers(TENANT_SELECTION_HEADER) tenantHeader: string | undefined,
    @Query() query: ProductionEventListQueryDto,
  ): Promise<ListResponse<ProductionEventV2View>> {
    return this.service.list(resolveRequestTenantId(user, tenantHeader), query);
  }
}
