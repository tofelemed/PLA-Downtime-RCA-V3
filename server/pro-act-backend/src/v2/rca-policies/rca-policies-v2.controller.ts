import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  RcaPolicyCreateDto,
  RcaPolicyCurrentQueryDto,
  RcaPolicyListQueryDto,
} from './rca-policies-v2.dto';
import { RcaPoliciesV2Service } from './rca-policies-v2.service';
import {
  RcaPolicyVersionV2View,
  toRcaPolicyView,
} from './rca-policies-v2.view';

/** RCA trigger policy versions (`rca_policy`, decision D13, plan 3.9). */
@ApiTags('v2 · RCA policies')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rca-policies', version: '2' })
export class RcaPoliciesV2Controller {
  constructor(private readonly policies: RcaPoliciesV2Service) {}

  @Get('current')
  @ApiOperation({
    summary:
      'The RCA trigger policy in force now (unit override, else tenant-wide)',
    description:
      'Without unitId the tenant-wide version. A tenant without any version gets the D13 default ' +
      '(3600 s, 3 failures in 30 days, recommend, no cost trigger) as version 1 on first read. unitId must ' +
      'be a unit of the tenant and the caller’s scope (422 INVALID_REFERENCE).',
  })
  async current(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaPolicyCurrentQueryDto,
  ): Promise<RcaPolicyVersionV2View> {
    return toRcaPolicyView(await this.policies.current(ctx, query.unitId));
  }

  @Get()
  @ApiOperation({
    summary:
      'Versions of the tenant-wide or one unit’s RCA trigger policy (newest first)',
    description:
      'Keyset pages on the version number (limit 1–100, default 20).',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaPolicyListQueryDto,
  ): Promise<ListResponse<RcaPolicyVersionV2View>> {
    const page = await this.policies.list(ctx, query);
    return listResponse(page.items.map(toRcaPolicyView), page.nextCursor, {
      tenantId: requireTenantId(ctx),
      ...(query.unitId ? { unitIds: [query.unitId] } : {}),
    });
  }

  @Post()
  @Idempotent()
  @Roles('manager_approver')
  @ApiOperation({
    summary: 'Record a new approved RCA trigger policy version, effective now',
    description:
      'Requires `Idempotency-Key`. Version n+1 of the scope (tenant-wide, or the unit override); the previous ' +
      'open version of the same scope ends now. The tenant-wide policy needs a tenant-wide grant (403 ' +
      'TENANT_SCOPE_REQUIRED); unitId must be a unit of the tenant and the caller’s scope (422 ' +
      'INVALID_REFERENCE); 422 INVALID_POLICY when the body breaks the rca_policy contract.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: RcaPolicyCreateDto,
  ): Promise<RcaPolicyVersionV2View> {
    return toRcaPolicyView(await this.policies.create(ctx, body));
  }
}
