import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import {
  FeatureFlagsService,
  FeatureFlagState,
} from '../../feature-flags/feature-flags.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { FeatureFlagSetDto } from './feature-flags-v2.dto';

export interface FeatureFlagsV2View {
  items: FeatureFlagState[];
  asOf: string;
  scope: { tenantId: string };
}

/** Server-side feature flags (plan 3.1 step 5, MIG02): which screens use their v2 binding. */
@ApiTags('v2 · Feature flags')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'feature-flags', version: '2' })
export class FeatureFlagsV2Controller {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get()
  @ApiOperation({
    summary: 'Every known flag with its value for the caller tenant',
    description:
      'Registry defaults (all off) overlaid with the tenant settings; readable by any tenant member.',
  })
  async list(@Ctx() ctx: RequestContext): Promise<FeatureFlagsV2View> {
    return {
      items: await this.flags.list(ctx),
      asOf: new Date().toISOString(),
      scope: { tenantId: requireTenantId(ctx) },
    };
  }

  @Put(':key')
  @Roles('manager_approver')
  @ApiOperation({
    summary: 'Switch one flag for the whole tenant',
    description:
      'Idempotent set. Needs manager_approver and a tenant-wide grant (403 TENANT_SCOPE_REQUIRED); unknown keys are 404.',
  })
  set(
    @Ctx() ctx: RequestContext,
    @Param('key') key: string,
    @Body() body: FeatureFlagSetDto,
  ): Promise<FeatureFlagState> {
    return this.flags.set(ctx, key, body.enabled);
  }
}
