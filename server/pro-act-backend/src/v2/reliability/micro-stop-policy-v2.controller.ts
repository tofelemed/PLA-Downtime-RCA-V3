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
import {
  MicroStopPolicyCreateDto,
  MicroStopPolicyQueryDto,
} from './micro-stop-policy-v2.dto';
import {
  MicroStopPolicyV2Service,
  PolicyInForce,
} from './micro-stop-policy-v2.service';

/** `GET /v2/micro-stop-policies/current` and the result of a new version (SME D6). */
export interface MicroStopPolicyV2View {
  /** `oee_policy` version id */
  id: string;
  /** null = tenant-wide (also when a unit asked and has no override) */
  unitId: string | null;
  version: number;
  microStopSeconds: number;
  microStopSecondsByAssetClass: Record<string, number>;
  tripReasonCodes: string[];
  effectiveFrom: string;
  notes: string | null;
}

function toView({ row, body }: PolicyInForce): MicroStopPolicyV2View {
  return {
    id: row.id,
    unitId: row.unitId,
    version: row.version,
    microStopSeconds: body.microStopSeconds,
    microStopSecondsByAssetClass: body.microStopSecondsByAssetClass ?? {},
    tripReasonCodes: body.tripReasonCodes ?? [],
    effectiveFrom: row.effectiveFrom.toISOString(),
    notes: row.notes,
  };
}

/** Micro-stop thresholds per unit and asset class, and trip reasons (SME D6; part of `oee_policy`). */
@ApiTags('v2 · Micro-stop policy')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'micro-stop-policies', version: '2' })
export class MicroStopPolicyV2Controller {
  constructor(private readonly policies: MicroStopPolicyV2Service) {}

  @Get('current')
  @ApiOperation({
    summary:
      'Micro-stop settings in force now (unit override, else tenant-wide)',
    description:
      'unitId must be a unit of the tenant and the caller’s scope (422 INVALID_REFERENCE). A tenant without an ' +
      'oee_policy gets the D04 default on first read.',
  })
  async current(
    @Ctx() ctx: RequestContext,
    @Query() query: MicroStopPolicyQueryDto,
  ): Promise<MicroStopPolicyV2View> {
    return toView(await this.policies.current(ctx, query.unitId));
  }

  @Post()
  @Idempotent()
  @Roles('manager_approver')
  @ApiOperation({
    summary:
      'Record new micro-stop settings as an approved oee_policy version, effective now',
    description:
      'Requires `Idempotency-Key`. Version n+1 of the scope; other oee_policy fields are kept from the version in ' +
      'force. Tenant-wide needs a tenant-wide grant (403 TENANT_SCOPE_REQUIRED); 422 INVALID_POLICY for a ' +
      'negative or non-numeric class threshold.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: MicroStopPolicyCreateDto,
  ): Promise<MicroStopPolicyV2View> {
    return toView(await this.policies.create(ctx, body));
  }
}
