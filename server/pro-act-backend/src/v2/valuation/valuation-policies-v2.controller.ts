import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { ValuationPoliciesService } from '../../valuation/valuation-policies.service';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  ValuationPolicyCreateDto,
  ValuationPolicyListQueryDto,
} from './valuation-v2.dto';
import { FINANCE_APPROVERS, FINANCE_MAINTAINERS } from './valuation-roles';
import {
  toValuationPolicyView,
  ValuationPolicyApproveV2View,
  ValuationPolicyV2View,
} from './valuation-v2.view';

/** `valuation_basis` policy versions of plan 2.6 (VAL01–VAL03, D08). */
@ApiTags('v2 · Valuation')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'valuation-policies', version: '2' })
export class ValuationPoliciesV2Controller {
  constructor(private readonly policies: ValuationPoliciesService) {}

  @Get()
  @ApiOperation({
    summary: 'List valuation policy versions of the tenant (newest first)',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: ValuationPolicyListQueryDto,
  ): Promise<ListResponse<ValuationPolicyV2View>> {
    const page = await this.policies.list(ctx, query);
    return listResponse(
      page.items.map(toValuationPolicyView),
      page.nextCursor,
      { tenantId: requireTenantId(ctx) },
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one valuation policy version; foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ValuationPolicyV2View> {
    return toValuationPolicyView(await this.policies.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...FINANCE_MAINTAINERS)
  @ApiOperation({
    summary: 'Create a new (unapproved) valuation policy version',
    description:
      'Requires `Idempotency-Key`. Tenant-wide setting: a tenant-wide grant is required (403 ' +
      'TENANT_SCOPE_REQUIRED). independentImpactCodeIds must be impact codes of the tenant (422 ' +
      'INVALID_REFERENCE). Older versions are never changed.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: ValuationPolicyCreateDto,
  ): Promise<ValuationPolicyV2View> {
    return toValuationPolicyView(await this.policies.create(ctx, body));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...FINANCE_APPROVERS)
  @ApiOperation({
    summary: 'Record the finance approval of a valuation policy version',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      'Requires `Idempotency-Key`. A tenant-wide grant is required (403 TENANT_SCOPE_REQUIRED); the author ' +
      'cannot approve (403 SEPARATION_OF_DUTIES); 409 INVALID_TRANSITION when already approved; 422 ' +
      'CURRENCY_UNDECIDED for the XXX placeholder. SME V7: the periods from its start are queued for ' +
      'revaluation (`revaluation`); approved periods get a change proposal.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ValuationPolicyApproveV2View> {
    const { policy, revaluation } = await this.policies.approve(ctx, id);
    return { ...toValuationPolicyView(policy), revaluation };
  }
}
