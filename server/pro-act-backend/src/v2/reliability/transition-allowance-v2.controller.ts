import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PolicyInForce } from './oee-policy-versions.service';
import {
  TransitionAllowanceCreateDto,
  TransitionAllowanceOption,
  TransitionAllowanceQueryDto,
} from './transition-allowance-v2.dto';
import { TransitionAllowanceV2Service } from './transition-allowance-v2.service';

/** `GET /v2/transition-allowance-policies/current` and the result of a new version (engine 2.5.6). */
export interface TransitionAllowanceV2View {
  /** `oee_policy` version id */
  id: string;
  /** null = tenant-wide (also when a unit asked and has no override) */
  unitId: string | null;
  version: number;
  transitionAllowanceInPlan: TransitionAllowanceOption;
  effectiveFrom: string;
  notes: string | null;
}

function toView({ row, body }: PolicyInForce): TransitionAllowanceV2View {
  return {
    id: row.id,
    unitId: row.unitId,
    version: row.version,
    transitionAllowanceInPlan: body.transitionAllowanceInPlan,
    effectiveFrom: row.effectiveFrom.toISOString(),
    notes: row.notes,
  };
}

/** Whether the plan already allows for standard grade transitions (engine 2.5.6; part of `oee_policy`). */
@ApiTags('v2 · Transition allowance policy')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'transition-allowance-policies', version: '2' })
export class TransitionAllowanceV2Controller {
  constructor(private readonly policies: TransitionAllowanceV2Service) {}

  @Get('current')
  @ApiOperation({
    summary:
      'Transition-allowance option in force now (unit override, else tenant-wide)',
    description:
      'unitId must be a unit of the tenant and the caller’s scope (422 INVALID_REFERENCE). A version written ' +
      'before the option existed reads `loss`.',
  })
  async current(
    @Ctx() ctx: RequestContext,
    @Query() query: TransitionAllowanceQueryDto,
  ): Promise<TransitionAllowanceV2View> {
    return toView(await this.policies.current(ctx, query.unitId));
  }

  @Post()
  @Idempotent()
  @Roles('manager_approver')
  @ApiOperation({
    summary:
      'Record the transition-allowance option as an approved oee_policy version, effective now',
    description:
      'Requires `Idempotency-Key`. Version n+1 of the scope; other oee_policy fields are kept from the version in ' +
      'force; periods already calculated keep the version they used. Tenant-wide needs a tenant-wide grant ' +
      '(403 TENANT_SCOPE_REQUIRED).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: TransitionAllowanceCreateDto,
  ): Promise<TransitionAllowanceV2View> {
    return toView(await this.policies.create(ctx, body));
  }
}
