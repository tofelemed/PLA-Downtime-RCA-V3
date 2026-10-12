import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import { PLANT_CONFIG_WRITERS } from '../administration-roles';
import {
  DashboardConfigV2View,
  DashboardSettingsDto,
} from './dashboard-config-v2.dto';
import { DashboardConfigV2Service } from './dashboard-config-v2.service';

/** Targets, thresholds and display options of the plant's plan dashboard (one document per plant). */
@ApiTags('v2 · Dashboard configuration')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'dashboard-configuration', version: '2' })
export class DashboardConfigV2Controller {
  constructor(private readonly config: DashboardConfigV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'The plant’s dashboard settings (defaults while none are stored)',
  })
  @ApiOkResponse({ type: DashboardConfigV2View })
  get(@Ctx() ctx: RequestContext): Promise<DashboardConfigV2View> {
    return this.config.get(ctx);
  }

  @Put()
  @Roles(...PLANT_CONFIG_WRITERS)
  @ApiOperation({
    summary: 'Store the plant’s dashboard settings (every section)',
  })
  @ApiOkResponse({ type: DashboardConfigV2View })
  save(
    @Ctx() ctx: RequestContext,
    @Body() body: DashboardSettingsDto,
  ): Promise<DashboardConfigV2View> {
    return this.config.save(ctx, body);
  }

  @Delete()
  @Roles(...PLANT_CONFIG_WRITERS)
  @ApiOperation({
    summary: 'Reset to the defaults (removes the stored settings)',
  })
  @ApiOkResponse({ type: DashboardConfigV2View })
  reset(@Ctx() ctx: RequestContext): Promise<DashboardConfigV2View> {
    return this.config.reset(ctx);
  }
}
