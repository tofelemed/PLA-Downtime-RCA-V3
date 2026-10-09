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
import { PlanScenariosService } from '../../plans/plan-scenarios.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PLAN_APPROVERS } from './plan-roles';
import { ScenarioCreateDto, ScenarioListQueryDto } from './plan-v2.dto';
import { PlanScenarioV2View, toScenarioView } from './plan-v2.view';
import { PlansV2Service } from './plans-v2.service';

/** Planning scenarios (plan 2.3, PLAN04): exactly one accounting baseline per tenant. */
@ApiTags('v2 · Production plans')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'plan-scenarios', version: '2' })
export class PlanScenariosV2Controller {
  constructor(
    private readonly reads: PlansV2Service,
    private readonly scenarios: PlanScenariosService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the tenant scenarios (keyset on createdAt, id)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: ScenarioListQueryDto,
  ): Promise<ListResponse<PlanScenarioV2View>> {
    return this.reads.listScenarios(ctx, query);
  }

  @Post()
  @Idempotent()
  @Roles(...PLAN_APPROVERS)
  @ApiOperation({
    summary:
      'Create a scenario (optionally moving the accounting-baseline flag to it)',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant (403 TENANT_SCOPE_REQUIRED for unit-limited callers). ' +
      '409 SCENARIO_EXISTS for a duplicate name.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: ScenarioCreateDto,
  ): Promise<PlanScenarioV2View> {
    return toScenarioView(await this.scenarios.create(ctx, body));
  }
}
